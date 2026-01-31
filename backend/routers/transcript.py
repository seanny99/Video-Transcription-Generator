"""
Transcript CRUD and status endpoints.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import get_db, Transcript, TranscriptSegment, MediaFile
from models.transcript import TranscriptionStatus
from utils.exceptions import NotFoundError, ConflictError
from engine.job_queue import enqueue_transcription

logger = logging.getLogger(__name__)
router = APIRouter()




@router.get("/media/{media_id}")
async def get_transcript_by_media(
    media_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get transcript for a specific media file."""
    result = await db.execute(
        select(Transcript)
        .options(selectinload(Transcript.segments))
        .where(Transcript.media_id == media_id)
    )
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise NotFoundError("Transcript not found for this media")
    
    return {
        "id": transcript.id,
        "media_id": transcript.media_id,
        "status": transcript.status.value,
        "full_text": transcript.full_text,
        "language": transcript.language,
        "duration_seconds": transcript.duration_seconds,
        "estimated_seconds": transcript.estimated_seconds,
        "remaining_seconds": transcript.remaining_seconds,
        "created_at": transcript.created_at.isoformat() + "Z",
        "completed_at": transcript.completed_at.isoformat() + "Z" if transcript.completed_at else None,
        "error_message": transcript.error_message,
        "segments": [
            {
                "id": seg.id,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "text": seg.text,
            }
            for seg in sorted(transcript.segments, key=lambda s: s.start_time)
        ]
    }





async def trigger_youtube_redownload(media, transcript, prompt=None):
    """Helper to restart download for missing files."""
    from routers.youtube import background_download
    from models.transcript import TranscriptionStatus
    import asyncio
    
    logger.info(f"Auto-redownloading missing file for media {media.id}")
    
    # Reset status
    transcript.status = TranscriptionStatus.DOWNLOADING
    transcript.download_progress = 0.0
    transcript.error_message = None
    
    # Launch background task
    asyncio.create_task(background_download(media.id, transcript.id, media.source_url, prompt))
    
    return {
        "transcript_id": transcript.id,
        "status": "downloading",
        "message": "Source file missing. Re-downloading..."
    }


@router.post("/media/{media_id}/transcribe")
async def start_transcription(
    media_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Start transcription for an uploaded media file."""
    # Check if media exists
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise NotFoundError("Media not found")
        
    # Check if file exists on disk
    import os
    from models.media import MediaSource
    
    file_exists = media.file_path and os.path.exists(media.file_path)
    
    # Smart Retry: If file missing and it's YouTube, re-download
    if not file_exists and media.source == MediaSource.YOUTUBE and media.source_url:
        # We need the transcript object to pass to downloader
        # Fetch or create it here
        result = await db.execute(select(Transcript).where(Transcript.media_id == media_id))
        existing = result.scalar_one_or_none()
        
        if existing:
             # Just trigger download on existing transcript
             return await trigger_youtube_redownload(media, existing)
        
        # If no transcript exists yet, we let it fall through to create one below,
        # BUT we still need to download. This is a rare edge case.
        # Let's simplify: if file missing, we MUST download.
        # Fall through to creation, then trigger download? unique flow.
        pass

    if not file_exists and not (media.source == MediaSource.YOUTUBE and media.source_url):
         raise NotFoundError(f"Media file not found on disk: {media.file_path}")
        
    # Check if file exists on disk
    import os
    from models.media import MediaSource
    
    file_exists = media.file_path and os.path.exists(media.file_path)
    
    # Smart Retry: If file missing and it's YouTube, re-download
    if not file_exists and media.source == MediaSource.YOUTUBE and media.source_url:
        # We need the transcript object to pass to downloader
        # Fetch or create it here
        result = await db.execute(select(Transcript).where(Transcript.media_id == media_id))
        existing = result.scalar_one_or_none()
        
        if not existing:
             # Should create one if missing, but let's stick to simple retry flow first
             # The code below creates it, so we can just let it fall through?
             # No, we need to return early if we start download.
             pass
        else:
             # Just trigger download on existing transcript
             # Need to commit DB changes first if we modified anything above (we didn't)
             return await trigger_youtube_redownload(media, existing)

    if not file_exists and not (media.source == MediaSource.YOUTUBE and media.source_url):
         raise NotFoundError(f"Media file not found on disk: {media.file_path}")
    
    # Check if transcript already exists
    result = await db.execute(
        select(Transcript).where(Transcript.media_id == media_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing and existing.status in [TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING]:
        # Check if it's actively processing (started within last 30 seconds)
        # If stale, allow retry - this short window allows quick resume after server restart 
        # or recovery from ghost PENDING states.
        from datetime import datetime, timedelta, timezone
        check_time = existing.started_at or existing.created_at
        
        # Ensure timezone awareness for comparison
        if check_time.tzinfo is None:
            check_time = check_time.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        
        is_stale = (now - check_time) > timedelta(seconds=30)
        if not is_stale:
            raise ConflictError("Transcription already in progress")
    # FAILED/CANCELED transcripts can always be resumed - no check needed
    
    # Create or reset transcript
    if existing:
        transcript = existing
        transcript.status = TranscriptionStatus.PENDING
        transcript.error_message = None
        
        # Only clear segments if no chunks have been processed (fresh start)
        # If chunks exist, this is a resume - keep existing segments
        if transcript.last_processed_chunk == 0 or transcript.last_processed_chunk is None:
            transcript.full_text = None
            transcript.last_processed_chunk = 0
            transcript.total_chunks = None
            # Clear existing segments for fresh start
            await db.execute(
                TranscriptSegment.__table__.delete().where(
                    TranscriptSegment.transcript_id == transcript.id
                )
            )
            logger.info(f"Fresh start for transcript {transcript.id}")
        else:
            logger.info(f"Resume from chunk {transcript.last_processed_chunk} for transcript {transcript.id}")
    else:
        transcript = Transcript(
            media_id=media_id,
            status=TranscriptionStatus.PENDING,
        )
        db.add(transcript)
    
    await db.flush()
    await db.refresh(transcript)
    
    # Commit before enqueueing to prevent race condition
    await db.commit()
    
    # Enqueue transcription job
    await enqueue_transcription(
        media_id=media_id,
        file_path=media.file_path
    )
    logger.info(f"Transcription queued: media_id={media_id}")
    
    return {
        "transcript_id": transcript.id,
        "status": "pending",
        "message": "Transcription started"
    }


@router.get("/{transcript_id}")
async def get_transcript(
    transcript_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get full transcript details."""
    result = await db.execute(
        select(Transcript)
        .options(selectinload(Transcript.segments))
        .where(Transcript.id == transcript_id)
    )
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise NotFoundError("Transcript not found")
    
    return {
        "id": transcript.id,
        "media_id": transcript.media_id,
        "status": transcript.status.value,
        "full_text": transcript.full_text,
        "language": transcript.language,
        "duration_seconds": transcript.duration_seconds,
        "created_at": transcript.created_at.isoformat() + "Z",
        "error_message": transcript.error_message,
        "segments": [
            {
                "id": seg.id,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "text": seg.text,
            }
            for seg in sorted(transcript.segments, key=lambda s: s.start_time)
        ]
    }


@router.get("/{transcript_id}/status")
async def get_transcript_status(
    transcript_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get transcription status and progress."""
    result = await db.execute(select(Transcript).where(Transcript.id == transcript_id))
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise NotFoundError("Transcript not found")
    
    return {
        "status": transcript.status.value,
        "progress": transcript.last_processed_chunk / transcript.total_chunks if transcript.total_chunks else 0,
        "last_processed_chunk": transcript.last_processed_chunk,
        "total_chunks": transcript.total_chunks,
        "error_message": transcript.error_message
    }


@router.post("/{transcript_id}/cancel")
async def cancel_transcription(
    transcript_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Cancel a running transcription job."""
    result = await db.execute(select(Transcript).where(Transcript.id == transcript_id))
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise NotFoundError("Transcript not found")
    
    if transcript.status in [TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING]:
        # Cancel in queue
        from engine.job_queue import JobQueue
        JobQueue.get_instance().cancel_job(transcript.media_id)
        
        # Update DB
        transcript.status = TranscriptionStatus.FAILED
        transcript.error_message = "Canceled by user"
        await db.commit()
        
        return {"message": "Transcription canceled"}
    
    raise ConflictError(f"Cannot cancel transcript in {transcript.status.value} state")


@router.get("/")
async def list_transcripts(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20,
    search: str = None
):
    """List all transcripts with pagination and optional deep search."""
    stmt = select(Transcript).options(selectinload(Transcript.media))
    
    if search:
        # Deep search: check title OR transcript content
        from sqlalchemy import or_
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Transcript.full_text.ilike(search_term),
                Transcript.media.has(MediaFile.title.ilike(search_term))
            )
        )
        
    result = await db.execute(
        stmt.order_by(Transcript.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    transcripts = result.scalars().all()
    
    return [
        {
            "id": t.id,
            "media_id": t.media_id,
            "media_title": t.media.title if t.media else None,
            "status": t.status.value,
            "language": t.language,
            "duration_seconds": t.duration_seconds,
            "created_at": t.created_at.isoformat() + "Z",
        }
        for t in transcripts
    ]
