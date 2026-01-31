"""
Singleton TranscriptionManager using faster-whisper.
Handles model loading and transcription with accent/hallucination tuning.
"""

import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class TranscriptionResult:
    """Result of a transcription job."""
    text: str
    segments: List[Dict[str, Any]]
    language: str
    duration: float


class TranscriptionManager:
    """
    Singleton manager for faster-whisper transcription.
    
    Loads the model once and reuses it for all transcriptions.
    Configured for accent handling and hallucination prevention.
    """
    
    _instance: Optional["TranscriptionManager"] = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._model_name = settings.whisper_model
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> "TranscriptionManager":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def reload_model(self, new_model_name: str) -> None:
        """Unload current model and reload with new model name."""
        if self._model_name == new_model_name and self._model is not None:
            logger.info(f"Model {new_model_name} already loaded.")
            return

        logger.info(f"Switching model from {self._model_name} to {new_model_name}...")
        self._model = None  # Force unload
        self._model_name = new_model_name
        
        # Trigger immediate load to verify/warmup
        self._load_model()
        logger.info(f"Model switched to {new_model_name}")

    def _load_model(self) -> None:
        """Load the faster-whisper model (lazy loading)."""
        if self._model is not None:
            return
        
        try:
            from faster_whisper import WhisperModel
            import os
            
            # Update settings for consistency
            settings.whisper_model = self._model_name

            # Dynamic Threading: Use ~70% of available cores (min 2, max 16)
            # This ensures the UI remains responsive while maximizing throughput
            total_cores = os.cpu_count() or 4
            num_threads = max(2, min(16, int(total_cores * 0.70)))
            logger.info(f"Configured engine with {num_threads} threads (detected {total_cores} cores)")
            
            # Try CUDA first, fall back to CPU
            try:
                from utils.perf_logger import perf_logger
                logger.info(f"Loading {self._model_name} model on CUDA...")
                perf_logger.start_phase("Model Loading")
                
                self._model = WhisperModel(
                    self._model_name,
                    device="cuda",
                    compute_type="float16"
                )
                
                perf_logger.end_phase("Model Loading", f"Size: {self._model_name} (CUDA)")
                logger.info("Model loaded successfully on CUDA")
            except Exception as cuda_error:
                logger.warning(f"CUDA not available ({cuda_error}), falling back to CPU")
                self._model = WhisperModel(
                    self._model_name,
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=num_threads
                )
                logger.info(f"Model loaded successfully on CPU with {num_threads} threads")
                
        except ImportError:
            raise RuntimeError("faster-whisper is not installed. Run: pip install faster-whisper")
    
    def transcribe(
        self,
        file_path: str,
        initial_prompt: Optional[str] = None,
        language: Optional[str] = None
    ) -> TranscriptionResult:
        """
        Transcribe an audio/video file.
        
        Args:
            file_path: Path to the media file
            initial_prompt: Optional context hint for better accuracy
                          (e.g., "A technical lecture by a speaker with a heavy accent")
            language: Optional language code (e.g., "en", "zh")
        
        Returns:
            TranscriptionResult with text, segments, language, and duration
        """
        self._load_model()
        
        if not Path(file_path).exists():
            raise FileNotFoundError(f"Media file not found: {file_path}")
        
        logger.info(f"Starting transcription: {file_path}")
        
        # Transcription parameters optimized for accents and hallucination prevention
        beam_size = 1 if "distil" in self._model_name.lower() else 5 # Distil models prefer greedy (1)
        
        transcribe_options = {
            "beam_size": beam_size,
            "best_of": 5 if beam_size > 1 else 1, # 'best_of' must be >= beam_size
            "vad_filter": True,  # Filter out silence/noise
            "vad_parameters": {
                "min_silence_duration_ms": 500,  # Prevent hallucinations in long pauses
            },
        }
        
        if initial_prompt:
            transcribe_options["initial_prompt"] = initial_prompt
            
        if language:
            transcribe_options["language"] = language
        
        # Run transcription
        segments_generator, info = self._model.transcribe(file_path, **transcribe_options)
        
        # Collect segments
        segments = []
        full_text_parts = []
        
        for segment in segments_generator:
            segments.append({
                "start_time": segment.start,
                "end_time": segment.end,
                "text": segment.text.strip(),
            })
            full_text_parts.append(segment.text.strip())
        
        full_text = " ".join(full_text_parts)
        
        logger.info(f"Transcription complete: {len(segments)} segments, language={info.language}")
        
        return TranscriptionResult(
            text=full_text,
            segments=segments,
            language=info.language,
            duration=info.duration
        )
    
    def preload_model(self) -> None:
        """
        Preload the model during startup to avoid first-request delay.
        Call this in the FastAPI lifespan event.
        """
        logger.info("Preloading transcription model...")
        self._load_model()
        logger.info("Model preloaded and ready")
    
    def transcribe_chunk(
        self,
        chunk_path: str,
        time_offset: float = 0.0,
        initial_prompt: Optional[str] = None,
        language: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Transcribe a single audio chunk.
        
        Timestamps are adjusted by time_offset to reflect position in original file.
        
        Args:
            chunk_path: Path to the chunk audio file.
            time_offset: Offset in seconds to add to all timestamps.
            initial_prompt: Optional context hint for accuracy.
            language: Optional language code (e.g., "en").
            
        Returns:
            List of segment dictionaries with adjusted timestamps.
        """
        self._load_model()
        
        if not Path(chunk_path).exists():
            raise FileNotFoundError(f"Chunk file not found: {chunk_path}")
        
        logger.info(f"Transcribing chunk: {chunk_path} (offset={time_offset}s)")

        from utils.perf_logger import perf_logger
        perf_logger.start_phase(f"Inference (Offset {time_offset:.1f}s)")
        
        
        beam_size = 1 if "distil" in self._model_name.lower() else 5
        
        transcribe_options = {
            "beam_size": beam_size,
            "best_of": 5 if beam_size > 1 else 1, # 'best_of' must be >= beam_size
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 500,
            },
        }
        
        if initial_prompt:
            transcribe_options["initial_prompt"] = initial_prompt
        if language:
            transcribe_options["language"] = language
        
        segments_generator, info = self._model.transcribe(chunk_path, **transcribe_options)
        
        # Collect segments with adjusted timestamps
        segments = []
        for segment in segments_generator:
            segments.append({
                "start_time": segment.start + time_offset,
                "end_time": segment.end + time_offset,
                "text": segment.text.strip(),
            })
        
        perf_logger.end_phase(f"Inference (Offset {time_offset:.1f}s)", f"{len(segments)} segments")
        
        logger.info(f"Chunk transcribed: {len(segments)} segments")
        return segments, info.language
