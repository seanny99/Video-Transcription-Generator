"""
YouTube URL processing endpoints.
Refactored to use the new queue-based transcription engine.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models import get_db, MediaFile, MediaSource, Transcript
from models.transcript import TranscriptionStatus
from services.youtube_service import YouTubeService
from utils.exceptions import ValidationError, ProcessingError
from engine.job_queue import enqueue_transcription

logger = logging.getLogger(__name__)
router = APIRouter()
youtube_service = YouTubeService()


class YouTubeRequest(BaseModel):
    """Request body for YouTube URL processing."""
    url: str
    auto_transcribe: bool = True
    initial_prompt: str = None  # Optional context for accents


class YouTubeInfoRequest(BaseModel):
    """Request body for getting video info."""
    url: str


@router.post("/info")
async def get_video_info(request: YouTubeInfoRequest):
    """
    Get YouTube video metadata without downloading.
    
    Returns: title, duration, thumbnail, uploader
    """
    logger.info(f"Video info request: {request.url}")
    try:
        info = youtube_service.get_video_info(request.url)
        return info
    except Exception as e:
        # AppError will be handled by global handler
        if "Invalid" in str(e):
             raise ValidationError(str(e))
        raise ProcessingError(str(e))


async def background_download(media_id: int, tr_id: int | None, url: str, prompt: str | None):
    from models.database import async_session
    from models import Transcript, MediaFile
    import asyncio
    
    # Callback to update DB with progress - Uses its OWN session to avoid concurrency issues
    async def update_progress(data: dict):
        if not tr_id: return
        
        async with async_session() as db_monitor:
            try:
                tr = await db_monitor.get(Transcript, tr_id)
                if not tr: return
                
                if data['status'] == 'downloading':
                    tr.download_progress = data.get('progress', 0.0)
                    # We'll use error_message temporarily for status text
                    status_msg = data.get('message', '')
                    # Only update if changed to reduce DB thrashing if needed, but for now writes are okay
                    tr.error_message = status_msg
                elif data['status'] == 'finished':
                    tr.download_progress = 100.0
                    tr.error_message = None
                
                await db_monitor.commit()
            except Exception as e:
                logger.error(f"Failed to update progress: {e}")

    # Main Download Process
    async with async_session() as b_db:
        try:
            logger.info(f"Starting background download for media {media_id}")

            # Run sync download in executor
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: youtube_service.download_video(
                    url, 
                    extract_audio=False,
                    progress_callback=lambda d: asyncio.run_coroutine_threadsafe(update_progress(d), loop)
                )
            )
            
            # Update Media Record with final details
            # We need to re-fetch because the session was just opened
            m_file = await b_db.get(MediaFile, media_id)
            if m_file:
                m_file.filename = result['filename']
                m_file.original_filename = result['filename']
                m_file.file_path = result['file_path']
                m_file.title = result.get('title')
                m_file.media_type = result['media_type']
            
            # Update Transcript Status -> PENDING
            if tr_id:
                tr = await b_db.get(Transcript, tr_id)
                if tr:
                    tr.status = TranscriptionStatus.PENDING
                    tr.download_progress = 100.0
                    tr.error_message = None # Clear any progress text
            
            await b_db.commit()
            
            # Trigger Transcription
            if tr_id:
                await enqueue_transcription(
                    media_id=media_id,
                    file_path=result['file_path'],
                    initial_prompt=prompt
                )
                
            logger.info(f"Background download complete for media {media_id}")
            
        except Exception as e:
            logger.error(f"Background download failed: {e}")
            if tr_id:
                tr = await b_db.get(Transcript, tr_id)
                if tr:
                    tr.status = TranscriptionStatus.FAILED
                    tr.error_message = f"Download Failed: {str(e)}"
                    await b_db.commit()

@router.post("/download")
async def download_youtube_video(
    request: YouTubeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Download YouTube video and optionally start transcription.
    
    Returns immediately with the media_id.
    Transcription is queued and processed by the worker.
    """
    try:
        # Create media record immediately with DOWNLOADING status
        # We don't have file details yet, so we use placeholders/user input
        import uuid
        temp_filename = f"dl_{str(uuid.uuid4())[:8]}" 
        
        media = MediaFile(
            filename=temp_filename,     # Placeholder, updated after download
            original_filename=request.url,
            file_path="",               # Placeholder
            media_type="video/mp4",     # Default/Placeholder
            source=MediaSource.YOUTUBE,
            source_url=request.url,
            title="Downloading...",
        )
        db.add(media)
        await db.flush()
        await db.refresh(media)
        
        # Create transcript record if auto-transcribe
        transcript_id = None
        if request.auto_transcribe:
            transcript = Transcript(
                media_id=media.id,
                status=TranscriptionStatus.DOWNLOADING, # Start in DOWNLOADING state
                download_progress=0.0
            )
            db.add(transcript)
            await db.flush()
            await db.refresh(transcript)
            transcript_id = transcript.id
        
        await db.commit()
        
        # Launch background task
        import asyncio
        asyncio.create_task(background_download(media.id, transcript_id, request.url, request.initial_prompt))
        
        return {
            "media_id": media.id,
            "transcript_id": transcript_id,
            "title": "Downloading...",
            "filename": "pending...",
            "transcription_started": request.auto_transcribe,
            "message": "Download started in background"
        }
        
    except Exception as e:
        logger.error(f"Failed to initiate download: {e}")
        raise ProcessingError(str(e))
