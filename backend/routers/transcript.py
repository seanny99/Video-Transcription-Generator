"""
Transcript CRUD and status endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from models import get_db, Transcript, TranscriptSegment, MediaFile
from models.transcript import TranscriptionStatus
from services.transcription_service import TranscriptionService

router = APIRouter()
transcription_service = TranscriptionService()


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
    
    return {
        "id": transcript.id,
        "status": transcript.status.value,
        "error_message": transcript.error_message,
    }


@router.post("/media/{media_id}/transcribe")
async def start_transcription(
    media_id: int,
    background_tasks: BackgroundTasks,
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
        raise HTTPException(
            status_code=409,
            detail="Transcription already in progress"
        )
    
    # Create or reset transcript
    if existing:
        transcript = existing
        transcript.status = TranscriptionStatus.PENDING
        transcript.error_message = None
        transcript.full_text = None
        # Clear existing segments
        await db.execute(
            TranscriptSegment.__table__.delete().where(
                TranscriptSegment.transcript_id == transcript.id
            )
        )
    else:
        transcript = Transcript(
            media_id=media_id,
            status=TranscriptionStatus.PENDING,
        )
        db.add(transcript)
    
    await db.flush()
    await db.refresh(transcript)
    
    # Start background transcription
    background_tasks.add_task(
        process_transcription_task,
        media_id,
        transcript.id,
        media.file_path
    )
    
    return {
        "transcript_id": transcript.id,
        "status": "pending",
        "message": "Transcription started"
    }


async def process_transcription_task(media_id: int, transcript_id: int, file_path: str):
    """Background task to process transcription."""
    from models.database import async_session
    import asyncio
    
    async with async_session() as db:
        try:
            # Update status to processing
            result = await db.execute(
                select(Transcript).where(Transcript.id == transcript_id)
            )
            transcript = result.scalar_one()
            transcript.status = TranscriptionStatus.PROCESSING
            await db.commit()
            
            # Run transcription in executor to avoid blocking
            loop = asyncio.get_event_loop()
            transcription_result = await loop.run_in_executor(
                None,
                lambda: transcription_service.transcribe(file_path)
            )
            
            # Update transcript with results
            result = await db.execute(
                select(Transcript).where(Transcript.id == transcript_id)
            )
            transcript = result.scalar_one()
            
            transcript.full_text = transcription_result['full_text']
            transcript.language = transcription_result['language']
            transcript.duration_seconds = transcription_result['duration']
            transcript.status = TranscriptionStatus.COMPLETED
            transcript.completed_at = datetime.utcnow()
            
            # Add segments
            for seg in transcription_result['segments']:
                segment = TranscriptSegment(
                    transcript_id=transcript_id,
                    start_time=seg['start_time'],
                    end_time=seg['end_time'],
                    text=seg['text'],
                )
                db.add(segment)
            
            await db.commit()
            
        except Exception as e:
            # Mark as failed
            result = await db.execute(
                select(Transcript).where(Transcript.id == transcript_id)
            )
            transcript = result.scalar_one()
            transcript.status = TranscriptionStatus.FAILED
            transcript.error_message = str(e)
            await db.commit()


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
