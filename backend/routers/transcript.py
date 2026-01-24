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
from engine.job_queue import enqueue_transcription

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{transcript_id}")
async def get_transcript(
    transcript_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get transcript by ID with all segments."""
    result = await db.execute(
        select(Transcript)
        .options(selectinload(Transcript.segments))
        .where(Transcript.id == transcript_id)
    )
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    return {
        "id": transcript.id,
        "media_id": transcript.media_id,
        "status": transcript.status.value,
        "full_text": transcript.full_text,
        "language": transcript.language,
        "duration_seconds": transcript.duration_seconds,
        "created_at": transcript.created_at.isoformat(),
        "completed_at": transcript.completed_at.isoformat() if transcript.completed_at else None,
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
        raise HTTPException(status_code=404, detail="Transcript not found for this media")
    
    # Calculate remaining time if processing
    remaining_seconds = None
    if transcript.status == TranscriptionStatus.PROCESSING and transcript.started_at and transcript.estimated_seconds:
        from datetime import datetime
        elapsed = (datetime.utcnow() - transcript.started_at).total_seconds()
        remaining_seconds = max(0, transcript.estimated_seconds - elapsed)
    
    return {
        "id": transcript.id,
        "media_id": transcript.media_id,
        "status": transcript.status.value,
        "full_text": transcript.full_text,
        "language": transcript.language,
        "duration_seconds": transcript.duration_seconds,
        "estimated_seconds": transcript.estimated_seconds,
        "remaining_seconds": remaining_seconds,
        "created_at": transcript.created_at.isoformat(),
        "completed_at": transcript.completed_at.isoformat() if transcript.completed_at else None,
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
    """Get just the status of a transcript (for polling)."""
    result = await db.execute(
        select(Transcript).where(Transcript.id == transcript_id)
    )
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    # Calculate remaining time if processing
    remaining_seconds = None
    if transcript.status == TranscriptionStatus.PROCESSING and transcript.started_at and transcript.estimated_seconds:
        from datetime import datetime
        elapsed = (datetime.utcnow() - transcript.started_at).total_seconds()
        remaining_seconds = max(0, transcript.estimated_seconds - elapsed)
    
    return {
        "id": transcript.id,
        "status": transcript.status.value,
        "error_message": transcript.error_message,
        "remaining_seconds": remaining_seconds  # Add remaining time to status object
    }


@router.post("/{transcript_id}/cancel")
async def cancel_transcript(
    transcript_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Cancel a running or pending transcription."""
    result = await db.execute(
        select(Transcript).where(Transcript.id == transcript_id)
    )
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
        
    if transcript.status in [TranscriptionStatus.COMPLETED, TranscriptionStatus.FAILED]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or failed transcript")
        
    # Mark as CANCELED
    transcript.status = TranscriptionStatus.CANCELED
    transcript.error_message = "Canceled by user"
    transcript.completed_at = None # Ensure completed_at is not set if it was previously
    
    await db.commit()
    logger.info(f"Transcript queued for cancellation: {transcript_id}")
    
    return {"message": "Transcription canceled"}


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
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Check if transcript already exists
    result = await db.execute(
        select(Transcript).where(Transcript.media_id == media_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing and existing.status in [TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING]:
        # Check if it's actively processing (started within last 30 seconds)
        # If stale, allow retry - this short window allows quick resume after server restart
        from datetime import datetime, timedelta
        check_time = existing.started_at or existing.created_at
        is_stale = (datetime.utcnow() - check_time) > timedelta(seconds=30)
        if not is_stale:
            raise HTTPException(
                status_code=409,
                detail="Transcription already in progress"
            )
    # FAILED transcripts can always be resumed - no check needed
    
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


@router.get("/")
async def list_transcripts(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """List all transcripts with pagination."""
    result = await db.execute(
        select(Transcript)
        .options(selectinload(Transcript.media))
        .order_by(Transcript.created_at.desc())
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
            "created_at": t.created_at.isoformat(),
        }
        for t in transcripts
    ]
