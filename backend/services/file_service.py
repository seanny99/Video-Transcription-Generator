"""
File upload service.
Handles file validation, storage, and retrieval.
"""

import uuid
import logging
import aiofiles
from pathlib import Path
from typing import BinaryIO

from config import settings

logger = logging.getLogger(__name__)


class FileError(Exception):
    """Base exception for file-related errors."""
    pass


class InvalidFileError(FileError):
    """Raised when file type is not allowed."""
    pass


class FileSizeError(FileError):
    """Raised when file exceeds size limit."""
    pass


class FileService:
    """Service for handling file uploads."""
    
    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.max_size = settings.max_upload_size_mb * 1024 * 1024  # Convert to bytes
        self.allowed_extensions = settings.allowed_extensions
    
    def validate_file(self, filename: str, file_size: int) -> None:
        """
        Validate file extension and size.
        
        Raises:
            InvalidFileError: If extension not allowed
            FileSizeError: If file too large
        """
        ext = Path(filename).suffix.lower()
        
        if ext not in self.allowed_extensions:
            raise InvalidFileError(
                f"File type '{ext}' not allowed. "
                f"Allowed types: {', '.join(self.allowed_extensions)}"
            )
        
        if file_size > self.max_size:
            max_mb = settings.max_upload_size_mb
            raise FileSizeError(f"File too large. Maximum size is {max_mb}MB")
    
    async def save_upload(
        self,
        file: BinaryIO,
        filename: str,
        chunk_size: int = 1024 * 1024  # 1MB chunks
    ) -> dict:
        """
        Save uploaded file to disk.
        
        Args:
            file: File-like object to read from
            filename: Original filename
            chunk_size: Size of chunks to read/write
            
        Returns:
            Dict with file_path, filename, etc.
        """
        # Generate unique filename to prevent collisions
        file_id = str(uuid.uuid4())[:8]
        ext = Path(filename).suffix.lower()
        safe_filename = f"{file_id}_{self._sanitize_filename(filename)}"
        
        file_path = self.upload_dir / safe_filename
        
        try:
            # Stream file to disk in chunks
            total_size = 0
            async with aiofiles.open(file_path, 'wb') as out_file:
                while chunk := await file.read(chunk_size):
                    total_size += len(chunk)
                    
                    # Check size during upload
                    if total_size > self.max_size:
                        await out_file.close()
                        file_path.unlink()  # Delete partial file
                        raise FileSizeError(
                            f"File too large. Maximum size is {settings.max_upload_size_mb}MB"
                        )
                    
                    await out_file.write(chunk)
            
            logger.info(f"Saved upload: {safe_filename} ({total_size} bytes)")
            
            return {
                'file_path': str(file_path),
                'filename': safe_filename,
                'original_filename': filename,
                'size': total_size,
                'media_type': self._get_media_type(ext),
            }
            
        except FileSizeError:
            raise
        except Exception as e:
            # Clean up on error
            if file_path.exists():
                file_path.unlink()
            logger.error(f"Failed to save upload: {e}")
            raise FileError(f"Failed to save file: {str(e)}")
    
    def _sanitize_filename(self, filename: str) -> str:
        """Remove unsafe characters from filename."""
        # Keep alphanumeric, dots, dashes, and underscores
        safe_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_')
        return ''.join(c if c in safe_chars else '_' for c in filename)
    
    def _get_media_type(self, extension: str) -> str:
        """Get MIME type from file extension."""
        media_types = {
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/mp4',
        }
        return media_types.get(extension, 'application/octet-stream')
    
    def get_file_path(self, filename: str) -> Path:
        """Get full path for a stored file."""
        return self.upload_dir / filename
    
    def delete_file(self, filename: str) -> bool:
        """Delete a stored file."""
        file_path = self.upload_dir / filename
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {filename}")
            return True
        return False
