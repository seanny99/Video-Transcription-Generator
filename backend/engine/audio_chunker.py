"""
Audio Chunker Service.
Splits audio/video files into smaller chunks for incremental transcription.
Uses ffmpeg for efficient audio extraction and splitting.
"""

import os
import logging
import subprocess
import shutil
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

from config import settings
from utils.exceptions import ProcessingError

logger = logging.getLogger(__name__)


@dataclass
class ChunkInfo:
    """Information about an audio chunk."""
    index: int
    path: str
    start_time: float  # seconds from beginning of original file
    duration: float    # chunk duration in seconds


class AudioChunker:
    """
    Splits audio/video files into chunks for incremental processing.
    
    Chunks are saved to a temporary directory and can be cleaned up
    after transcription is complete.
    """
    
    # Default chunk duration in seconds (60 seconds = 1 minute)
    DEFAULT_CHUNK_DURATION = 60
    
    def __init__(self, chunk_dir: Optional[str] = None):
        """
        Initialize the audio chunker.
        
        Args:
            chunk_dir: Directory to store chunk files. Defaults to downloads/chunks.
        """
        self.chunk_dir = chunk_dir or os.path.join(settings.download_dir, "chunks")
        os.makedirs(self.chunk_dir, exist_ok=True)
    
    def get_audio_duration(self, file_path: str) -> float:
        """
        Get the duration of an audio/video file in seconds.
        
        Args:
            file_path: Path to the media file.
            
        Returns:
            Duration in seconds.
            
        Raises:
            RuntimeError: If ffprobe fails to get duration.
        """
        try:
            result = subprocess.run(
                [
                    settings.ffprobe_path,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file_path
                ],
                capture_output=True,
                text=True,
                check=True
            )
            return float(result.stdout.strip())
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to get audio duration: {e.stderr}")
            raise ProcessingError(f"Failed to get audio duration: {e.stderr}")
        except ValueError:
            raise ProcessingError("Could not parse audio duration")
    
    def split_audio(
        self,
        file_path: str,
        media_id: int,
        chunk_duration: int = DEFAULT_CHUNK_DURATION
    ) -> List[ChunkInfo]:
        """
        Split an audio/video file into chunks.
        
        Extracts audio and splits into WAV chunks for consistent processing.
        
        Args:
            file_path: Path to the source media file.
            media_id: ID of the media file (used for chunk naming).
            chunk_duration: Duration of each chunk in seconds.
            
        Returns:
            List of ChunkInfo objects for each chunk.
            
        Raises:
            FileNotFoundError: If source file doesn't exist.
            RuntimeError: If ffmpeg fails.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Source file not found: {file_path}")
        
        # Create subdirectory for this media's chunks
        media_chunk_dir = os.path.join(self.chunk_dir, str(media_id))
        os.makedirs(media_chunk_dir, exist_ok=True)
        
        total_duration = self.get_audio_duration(file_path)
        chunks: List[ChunkInfo] = []
        
        last_chunk_path = os.path.join(media_chunk_dir, f"chunk_{int(total_duration // chunk_duration):04d}.wav")
        
        # Use FFmpeg segment muxer to split in one pass (Order of magnitude faster)
        output_pattern = os.path.join(media_chunk_dir, "chunk_%04d.wav")
        
        try:
            logger.info(f"Splitting audio into chunks using fast segment muxer...")
            subprocess.run(
                [
                    settings.ffmpeg_path,
                    "-y",
                    "-i", file_path,
                    "-vn",  # No video
                    "-ar", "16000",  # 16kHz sample rate (Whisper optimal)
                    "-ac", "1",  # Mono
                    "-c:a", "pcm_s16le",  # WAV format
                    "-f", "segment",
                    "-segment_time", str(chunk_duration),
                    "-reset_timestamps", "1",
                    output_pattern
                ],
                capture_output=True,
                check=True
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to split chunks: {e.stderr}")
            raise ProcessingError(f"Failed to split chunks: {e.stderr}")

        # Collect the created chunks
        import glob
        existing = sorted(glob.glob(os.path.join(media_chunk_dir, "chunk_*.wav")))
        
        chunks: List[ChunkInfo] = []
        for i, path in enumerate(existing):
            # Calculate start time based on index
            start_t = i * chunk_duration
            # Get actual duration of this chunk
            dur = self.get_audio_duration(path)
            
            chunks.append(ChunkInfo(
                index=i,
                path=path,
                start_time=start_t,
                duration=dur
            ))
            
        logger.info(f"Split {file_path} into {len(chunks)} chunks (Fast Mode)")
        return chunks
    
    def get_existing_chunks(self, media_id: int) -> List[ChunkInfo]:
        """
        Get list of existing chunks for a media file.
        
        Useful for resume - checks what chunks already exist.
        
        Args:
            media_id: ID of the media file.
            
        Returns:
            List of ChunkInfo for existing chunks, sorted by index.
        """
        media_chunk_dir = os.path.join(self.chunk_dir, str(media_id))
        if not os.path.exists(media_chunk_dir):
            return []
        
        chunks = []
        for filename in sorted(os.listdir(media_chunk_dir)):
            if filename.startswith("chunk_") and filename.endswith(".wav"):
                try:
                    index = int(filename[6:10])
                    chunk_path = os.path.join(media_chunk_dir, filename)
                    duration = self.get_audio_duration(chunk_path)
                    # Start time will be approximate (chunk_duration * index)
                    chunks.append(ChunkInfo(
                        index=index,
                        path=chunk_path,
                        start_time=index * self.DEFAULT_CHUNK_DURATION,
                        duration=duration
                    ))
                except (ValueError, RuntimeError):
                    continue
        
        return sorted(chunks, key=lambda c: c.index)
    
    def cleanup_chunks(self, media_id: int) -> None:
        """
        Remove all chunk files for a media file.
        
        Call this after transcription is complete.
        
        Args:
            media_id: ID of the media file.
        """
        media_chunk_dir = os.path.join(self.chunk_dir, str(media_id))
        if os.path.exists(media_chunk_dir):
            shutil.rmtree(media_chunk_dir)
            logger.info(f"Cleaned up chunks for media_id={media_id}")
