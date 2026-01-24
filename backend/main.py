"""
FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from config import settings
from utils.exceptions import AppError
from models.database import init_db, async_session
from models.transcript import Transcript, TranscriptionStatus
from engine.job_queue import JobQueue, TranscriptionJob
from engine.transcription_manager import TranscriptionManager

# Configure logging to show INFO level logs (needed for perf_logger)
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',  # perf_logger handles the timestamp formatting
    force=True  # Override any existing config
)

logger = logging.getLogger(__name__)


async def reconcile_stuck_jobs():
    """
    Recover from crashes by fixing stuck tasks.
    Called on every startup.
    Marks stuck tasks as failed so users can manually resume them.
    """
    async with async_session() as db:
        # Find stuck PROCESSING tasks (crashed mid-transcription)
        result = await db.execute(
            select(Transcript).where(Transcript.status == TranscriptionStatus.PROCESSING)
        )
        processing_tasks = result.scalars().all()
        
        for task in processing_tasks:
            logger.warning(f"Recovering stuck task: transcript_id={task.id} (was PROCESSING)")
            task.status = TranscriptionStatus.FAILED
            task.error_message = "Interrupted: Server was restarted during transcription. Click Resume to retry."
        
        # Find PENDING tasks that weren't processed (server was stopped before they started)
        result = await db.execute(
            select(Transcript).where(Transcript.status == TranscriptionStatus.PENDING)
        )
        pending_tasks = result.scalars().all()
        
        for task in pending_tasks:
            logger.warning(f"Marking pending task as failed: transcript_id={task.id} (was PENDING)")
            task.status = TranscriptionStatus.FAILED
            task.error_message = "Interrupted: Server was restarted before transcription started. Click Resume to retry."
        
        await db.commit()
        
        if processing_tasks or pending_tasks:
            logger.info(f"Reconciliation complete: {len(processing_tasks)} processing, {len(pending_tasks)} pending → all marked as failed")


async def process_transcription_job(job: TranscriptionJob):
    """
    Process a single transcription job using chunk-based processing.
    
    Splits audio into chunks and processes each one, saving progress
    after each chunk. This enables resume from the exact point of interruption.
    """
    from datetime import datetime
    from models.transcript import TranscriptSegment
    from models.media import MediaFile
    from engine.audio_chunker import AudioChunker
    import asyncio
    import os
    
    chunker = AudioChunker()
    manager = TranscriptionManager.get_instance()
    
    async with async_session() as db:
        try:
            # Get transcript record
            result = await db.execute(
                select(Transcript).where(Transcript.media_id == job.media_id)
            )
            transcript = result.scalar_one_or_none()
            
            if not transcript:
                logger.error(f"Transcript not found for media_id={job.media_id}")
                return
            
            # Get media file
            media_result = await db.execute(
                select(MediaFile).where(MediaFile.id == job.media_id)
            )
            media = media_result.scalar_one_or_none()
            
            if not media or not os.path.exists(media.file_path):
                raise FileNotFoundError(f"Media file not found: {job.file_path}")
            
            # Update status to PROCESSING
            transcript.status = TranscriptionStatus.PROCESSING
            transcript.started_at = datetime.utcnow()
            
            # --- PHASE 1: AUDIO SPLITTING ---
            from utils.perf_logger import perf_logger
            perf_logger.start_phase(f"Audio Splitting (Job {job.media_id})")
            
            # Split audio into chunks (or get existing chunks for resume)
            chunks = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: chunker.split_audio(media.file_path, job.media_id)
            )
            
            perf_logger.end_phase(f"Audio Splitting (Job {job.media_id})", f"{len(chunks)} chunks created")
            
            # Update total chunks count
            transcript.total_chunks = len(chunks)
            await db.commit()
            
            logger.info(f"Processing {len(chunks)} chunks for media_id={job.media_id}, resuming from chunk {transcript.last_processed_chunk}")
            
            # Determine start chunk (for resume)
            start_chunk = transcript.last_processed_chunk
            
            # Process each chunk from where we left off
            all_segments_text = []
            
            # Load existing segments if resuming
            if start_chunk > 0:
                stmt = select(TranscriptSegment).where(
                    TranscriptSegment.transcript_id == transcript.id
                ).order_by(TranscriptSegment.start_time)
                existing_segs = await db.execute(stmt)
                for seg in existing_segs.scalars().all():
                    all_segments_text.append(seg.text)
                
                logger.info(f"Loaded {len(all_segments_text)} existing segments for resume")

            detected_language = None
            total_duration = 0.0
            
            # --- PHASE 2: TRANSCRIPTION LOOP ---
            current_model = settings.whisper_model
            logger.info(f"Starting transcription loop using model: {current_model}")
            perf_logger.start_phase(f"Transcription Loop (Job {job.media_id})")
            
            queue = JobQueue.get_instance()
            
            for chunk in chunks:
                # Check for cancellation
                if queue.is_cancelled(job.media_id):
                    logger.warning(f"Job cancelled during processing: media_id={job.media_id}")
                    perf_logger.end_phase(f"Transcription Loop (Job {job.media_id})", "CANCELLED")
                    return

                # Skip already processed chunks
                if chunk.index < start_chunk:
                    continue
                
                # Check for cancellation before processing chunk
                await db.execute(select(Transcript).where(Transcript.id == transcript.id))  # Refresh object
                await db.refresh(transcript)
                if transcript.status == TranscriptionStatus.CANCELED:
                    logger.info(f"Job canceled: {job.media_id}")
                    chunker.cleanup_chunks(job.media_id)
                    perf_logger.end_phase(f"Transcription Loop (Job {job.media_id})", "CANCELED")
                    return

                logger.info(f"Processing chunk {chunk.index + 1}/{len(chunks)}")
                
                # Transcribe chunk
                chunk_segments = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda c=chunk: manager.transcribe_chunk(
                        c.path,
                        time_offset=c.start_time,
                        language=job.language
                    )
                )
                
                # Check for cancellation after heavy processing
                await db.refresh(transcript)
                if transcript.status == TranscriptionStatus.CANCELED:
                    logger.info(f"Job canceled after chunk {chunk.index}: {job.media_id}")
                    chunker.cleanup_chunks(job.media_id)
                    perf_logger.end_phase(f"Transcription Loop (Job {job.media_id})", "CANCELED")
                    return
                
                logger.info(f"Chunk transcribed: {len(chunk_segments)} segments found")
                
                # Add segments to database
                for seg in chunk_segments:
                    segment = TranscriptSegment(
                        transcript_id=transcript.id,
                        start_time=seg['start_time'],
                        end_time=seg['end_time'],
                        text=seg['text'],
                    )
                    db.add(segment)
                    all_segments_text.append(seg['text'])
                
                # Update progress checkpoint
                transcript.last_processed_chunk = chunk.index + 1
                total_duration = chunk.start_time + chunk.duration
                
                # Calculate ETA
                elapsed = (datetime.utcnow() - transcript.started_at).total_seconds()
                chunks_done = chunk.index + 1
                if chunks_done > 0:
                    avg_per_chunk = elapsed / chunks_done
                    remaining = len(chunks) - chunks_done
                    transcript.estimated_seconds = avg_per_chunk * remaining
                
                # Commit after each chunk - this is the checkpoint
                await db.commit()
                logger.info(f"Checkpoint saved: chunk {chunk.index + 1}/{len(chunks)} complete (ETA: {transcript.estimated_seconds:.0f}s)")
            
            perf_logger.end_phase(f"Transcription Loop (Job {job.media_id})", "COMPLETED")

            # All chunks complete - finalize
            transcript.full_text = " ".join(all_segments_text)
            transcript.duration_seconds = total_duration
            transcript.status = TranscriptionStatus.COMPLETED
            transcript.completed_at = datetime.utcnow()
            transcript.error_message = None
            
            await db.commit()
            
            # cleanup
            chunker.cleanup_chunks(job.media_id)
            
            logger.info(f"Transcription complete: media_id={job.media_id}")
            
        except Exception as e:
            logger.error(f"Transcription failed: media_id={job.media_id}, error={e}")
            # Mark as failed but preserve progress
            try:
                result = await db.execute(
                    select(Transcript).where(Transcript.media_id == job.media_id)
                )
                transcript = result.scalar_one_or_none()
                if transcript:
                    transcript.status = TranscriptionStatus.FAILED
                    transcript.error_message = f"{str(e)} (Progress: chunk {transcript.last_processed_chunk}/{transcript.total_chunks or '?'})"
                    await db.commit()
            except Exception:
                pass



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup (init, reconciliation, worker) and shutdown.
    """
    # === STARTUP ===
    logger.info("Starting application...")
    
    # Initialize database
    await init_db()
    
    # Set up job queue
    queue = JobQueue.get_instance()
    queue.set_processor(process_transcription_job)
    
    # Reconcile any stuck jobs from previous crash
    await reconcile_stuck_jobs()
    
    # Start the worker
    await queue.start_worker()
    
    # Optionally preload model (uncomment for faster first request)
    # TranscriptionManager.get_instance().preload_model()
    
    logger.info("Application ready")
    
    yield
    
    # === SHUTDOWN ===
    logger.info("Shutting down...")
    await queue.stop_worker(wait_for_current=True)
    logger.info("Shutdown complete")


# Create FastAPI app with lifespan
app = FastAPI(
    title=settings.app_name,
    description="Video/Audio transcription service with YouTube support",
    version="4.0.0",
    lifespan=lifespan
)

# CORS middleware for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError):
    """Global handler for custom application errors."""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "type": type(exc).__name__}
    )

# Include routers
from routers import media, transcript, youtube, system
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(transcript.router, prefix="/api/transcripts", tags=["Transcripts"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["YouTube"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from engine.job_queue import JobQueue
    queue = JobQueue.get_instance()
    return {
        "status": "healthy",
        "app": settings.app_name,
        "queue_size": queue.queue_size,
        "worker_running": queue.is_running
    }


def find_available_port(host: str, start_port: int, max_attempts: int = 10) -> int:
    """Find the first available port starting from start_port."""
    import socket
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except socket.error:
                continue
    return -1


if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Try to find an available port starting from settings.port
    final_port = find_available_port(settings.host, settings.port)
    
    if final_port == -1:
        logger.critical(f"FATAL: Could not find any available ports starting from {settings.port}.")
        sys.exit(1)
    
    # Update settings with the final port
    settings.port = final_port
    
    # Write the selected port to a discovery file for the frontend
    port_file = settings.base_dir / "backend_port.txt"
    try:
        port_file.write_text(str(final_port))
        logger.info(f"Port discovery file created at {port_file}: {final_port}")
    except Exception as e:
        logger.error(f"Failed to create port discovery file: {e}")

    logger.info(f"Starting server on {settings.host}:{settings.port}")
    uvicorn.run(app, host=settings.host, port=settings.port)

