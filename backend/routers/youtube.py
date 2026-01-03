"""
YouTube URL processing endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from models import get_db, MediaFile, MediaSource, Transcript, TranscriptSegment
from models.transcript import TranscriptionStatus
from services.youtube_service import YouTubeService, InvalidURLError, DownloadError
from services.transcription_service import TranscriptionService

router = APIRouter()
youtube_service = YouTubeService()
transcription_service = TranscriptionService()


class YouTubeRequest(BaseModel):
    """Request body for YouTube URL processing."""
    url: str
    auto_transcribe: bool = True


class YouTubeInfoRequest(BaseModel):
    """Request body for getting video info."""
    url: str


@router.post("/info")
async def get_video_info(request: YouTubeInfoRequest):
    """
    Get YouTube video metadata without downloading.
    
    Returns: title, duration, thumbnail, uploader
    """
    print(f"Received video info request for: {request.url}")
    try:
        info = youtube_service.get_video_info(request.url)
        return info
    except InvalidURLError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DownloadError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/download")
async def download_youtube_video(
    request: YouTubeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Download YouTube video and optionally start transcription.
    
    This returns immediately with the media ID.
    Transcription runs in the background.
    """
    try:
        # Download video
        result = youtube_service.download_video(request.url, extract_audio=False)
        
        # Get video info for title
        info = youtube_service.get_video_info(request.url)
        
        # Create media record
        media = MediaFile(
            filename=result['filename'],
            original_filename=result['filename'],
            file_path=result['file_path'],
            media_type=result['media_type'],
            source=MediaSource.YOUTUBE,
            source_url=request.url,
            title=info.get('title'),
        )
        db.add(media)
        await db.flush()
        await db.refresh(media)
        
        # Create pending transcript if auto-transcribe is enabled
        if request.auto_transcribe:
            transcript = Transcript(
                media_id=media.id,
                status=TranscriptionStatus.PENDING,
            )
            db.add(transcript)
            await db.flush()
            await db.refresh(transcript)
            
            background_tasks.add_task(
                process_transcription,
                media.id,
                transcript.id,
                result['file_path']
            )
        
        # Explicit commit to ensure background task can find the records
        await db.commit()
        
        return {
            "media_id": media.id,
            "title": media.title,
            "filename": media.filename,
            "transcription_started": request.auto_transcribe,
            "message": "Video downloaded successfully"
        }
        
    except InvalidURLError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DownloadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


async def process_transcription(media_id: int, transcript_id: int, file_path: str):
    """Background task to process transcription."""
    from models.database import async_session
    from datetime import datetime
    
    async with async_session() as db:
        transcript = None
        try:
            # Update status to processing
            result = await db.execute(
                select(Transcript).where(Transcript.id == transcript_id)
            )
            transcript = result.scalar_one_or_none()
            
            if not transcript:
                print(f"Error: Transcript {transcript_id} not found in background task")
                return

            transcript.status = TranscriptionStatus.PROCESSING
            await db.commit()
            
            # Run transcription (this is blocking but runs in thread pool)
            import asyncio
            loop = asyncio.get_event_loop()
            transcription_result = await loop.run_in_executor(
                None,
                lambda: transcription_service.transcribe(file_path)
            )
            
            # Update transcript with results
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
            print(f"Transcription failed: {e}")
            if transcript:
                transcript.status = TranscriptionStatus.FAILED
                transcript.error_message = str(e)
                await db.commit()


# Need to import select for the background task
from sqlalchemy import select
