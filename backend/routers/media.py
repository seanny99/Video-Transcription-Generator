"""
Media file upload and retrieval endpoints.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path

from models import get_db, MediaFile, MediaSource
from services.file_service import FileService
from utils.exceptions import NotFoundError, ValidationError, ProcessingError

router = APIRouter()
file_service = FileService()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a media file for transcription.
    
    Accepts: mp3, mp4, wav, webm, m4a, mkv
    Max size: 500MB
    """
    try:
        # Validate before processing
        file_service.validate_file(file.filename, file.size or 0)
        
        # Save file to disk
        result = await file_service.save_upload(file, file.filename)
        
        # Create database record
        media = MediaFile(
            filename=result['filename'],
            original_filename=result['original_filename'],
            file_path=result['file_path'],
            media_type=result['media_type'],
            source=MediaSource.UPLOAD,
        )
        db.add(media)
        await db.flush()
        await db.refresh(media)
        await db.commit()
        
        return {
            "id": media.id,
            "filename": media.filename,
            "original_filename": media.original_filename,
            "media_type": media.media_type,
            "message": "File uploaded successfully"
        }
        
    except Exception as e:
        if "type" in str(e) or "large" in str(e):
            raise ValidationError(str(e))
        raise ProcessingError(f"Upload failed: {str(e)}")


@router.get("/{media_id}")
async def get_media(
    media_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get media file metadata by ID."""
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise NotFoundError("Media not found")
    
    return {
        "id": media.id,
        "filename": media.filename,
        "original_filename": media.original_filename,
        "media_type": media.media_type,
        "source": media.source.value,
        "title": media.title,
        "created_at": media.created_at.isoformat(),
    }


@router.get("/{media_id}/stream")
async def stream_media(
    media_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Stream media file for playback."""
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise NotFoundError("Media not found")
    
    file_path = Path(media.file_path)
    if not file_path.exists():
        raise NotFoundError("Media file not found on disk")
    
    return FileResponse(
        file_path,
        media_type=media.media_type,
        filename=media.original_filename
    )


@router.delete("/{media_id}")
async def delete_media(
    media_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a media file and its associated transcript."""
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise NotFoundError("Media not found")
    
    # Cancel any running/pending job
    from engine.job_queue import JobQueue
    JobQueue.get_instance().cancel_job(media_id)
    
    # Clean up chunks
    from engine.audio_chunker import AudioChunker
    AudioChunker().cleanup_chunks(media_id)

    # Delete file from disk (handle both uploads and direct paths)
    try:
        if media.source == MediaSource.UPLOAD:
            file_service.delete_file(media.filename)
        else:
            # For YouTube/Direct, use the stored file_path
            path = Path(media.file_path)
            logger.info(f"Attempting to delete file at: {path} (Exists: {path.exists()})")
            if path.exists():
                path.unlink()
                logger.info(f"Deleted source file: {path}")
                # Try to delete accompanying json/info files if they exist (yt-dlp artifacts)
                for ext in ['.info.json', '.description', '.jpg', '.webp', '.png']:
                    meta_file = path.with_suffix(ext)
                    if meta_file.exists():
                        meta_file.unlink()
            else:
                logger.warning(f"File not found during deletion: {path}")
    except Exception as e:
        # Log error but continue with DB deletion
        logger.error(f"Error deleting file {media.file_path}: {e}")
    
    # Delete from database (cascades to transcript)
    await db.delete(media)
    await db.commit()
    
    return {"message": "Media deleted successfully"}
