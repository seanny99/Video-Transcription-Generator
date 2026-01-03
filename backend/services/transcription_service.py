"""
Transcription service using OpenAI Whisper.
Handles audio transcription with word-level timestamps.
"""

import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
import whisper
import torch

from config import settings
from models.transcript import TranscriptionStatus

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    """Base exception for transcription errors."""
    pass


class ModelLoadError(TranscriptionError):
    """Raised when Whisper model fails to load."""
    pass


class TranscriptionService:
    """Service for transcribing audio using Whisper."""
    
    def __init__(self):
        self._model = None
        self._model_name = settings.whisper_model
        
    @property
    def model(self):
        """Lazy load Whisper model."""
        if self._model is None:
            self._load_model()
        return self._model
    
    def _load_model(self):
        """Load Whisper model into memory."""
        try:
            logger.info(f"Loading Whisper model: {self._model_name}")
            
            # Use CUDA if available for faster processing
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device: {device}")
            
            self._model = whisper.load_model(self._model_name, device=device)
            logger.info("Whisper model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise ModelLoadError(f"Could not load Whisper model: {str(e)}")
    
    def transcribe(
        self,
        file_path: str,
        language: Optional[str] = "en",
        word_timestamps: bool = True,
        progress_callback: Optional[callable] = None
    ) -> dict:
        """
        Transcribe audio/video file.
        
        Args:
            file_path: Path to the audio/video file
            language: Language code (e.g., 'en'). None for auto-detect.
            word_timestamps: Include word-level timing
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict with full_text, segments, language, and duration
        """
        path = Path(file_path)
        if not path.exists():
            raise TranscriptionError(f"File not found: {file_path}")
        
        if progress_callback:
            progress_callback({'status': 'loading', 'message': 'Loading audio...'})
        
        try:
            logger.info(f"Starting transcription: {file_path}")
            start_time = datetime.utcnow()
            
            # Whisper transcription options
            options = {
                'language': language,
                'word_timestamps': word_timestamps,
                'verbose': False,
            }
            
            if progress_callback:
                progress_callback({'status': 'processing', 'message': 'Transcribing...'})
            
            result = self.model.transcribe(str(path), **options)
            
            # Extract segments with timestamps
            segments = []
            for segment in result.get('segments', []):
                segments.append({
                    'start_time': segment['start'],
                    'end_time': segment['end'],
                    'text': segment['text'].strip(),
                })
            
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Transcription completed in {elapsed:.2f}s")
            
            if progress_callback:
                progress_callback({'status': 'completed', 'message': 'Done!'})
            
            return {
                'full_text': result.get('text', '').strip(),
                'segments': segments,
                'language': result.get('language', language),
                'duration': segments[-1]['end_time'] if segments else 0,
            }
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            if progress_callback:
                progress_callback({'status': 'failed', 'message': str(e)})
            raise TranscriptionError(f"Transcription failed: {str(e)}")
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model."""
        return {
            'model_name': self._model_name,
            'loaded': self._model is not None,
            'device': str(next(self.model.parameters()).device) if self._model else None,
            'cuda_available': torch.cuda.is_available(),
        }
