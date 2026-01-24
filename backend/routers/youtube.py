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
        # Download video
        logger.info(f"Downloading video: {request.url}")
        result = youtube_service.download_video(request.url, extract_audio=False)
        
        # Create media record
        media = MediaFile(
            filename=result['filename'],
            original_filename=result['filename'],
            file_path=result['file_path'],
            media_type=result['media_type'],
            source=MediaSource.YOUTUBE,
            source_url=request.url,
            title=result.get('title'),
        )
        db.add(media)
        await db.flush()
        await db.refresh(media)
        
        transcript_id = None
        
        # Create pending transcript if auto-transcribe is enabled
        if request.auto_transcribe:
            transcript = Transcript(
                media_id=media.id,
                status=TranscriptionStatus.PENDING,
            )
            db.add(transcript)
            await db.flush()
            await db.refresh(transcript)
            transcript_id = transcript.id
        
        # Commit BEFORE enqueuing to prevent race condition
        await db.commit()
        
        # Enqueue transcription job (non-blocking)
        if request.auto_transcribe:
            await enqueue_transcription(
                media_id=media.id,
                file_path=result['file_path'],
                initial_prompt=request.initial_prompt
            )
            logger.info(f"Transcription queued: media_id={media.id}")
        
        return {
            "media_id": media.id,
            "transcript_id": transcript_id,
            "title": media.title,
            "filename": media.filename,
            "transcription_started": request.auto_transcribe,
            "message": "Video downloaded successfully"
        }
        
    except Exception as e:
        if "Invalid" in str(e):
            raise ValidationError(str(e))
        if "failed" in str(e).lower():
            raise ProcessingError(str(e))
        raise e
