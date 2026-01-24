"""
Application configuration management.
Centralizes all configuration settings for the transcription service.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "Video Transcription Generator"
    debug: bool = False
    
    # Paths
    import sys
    base_dir: Path = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
    upload_dir: Path = base_dir / "uploads"
    download_dir: Path = base_dir / "downloads"
    database_url: str = f"sqlite:///{base_dir / 'transcripts.db'}"
    
    # FFmpeg auto-detection with fallback
    ffmpeg_path: str = os.getenv(
        "FFMPEG_PATH", 
        r"C:\Users\seany\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
    )

    # Transcription (faster-whisper)
    # Using distil-large-v3 for 6x faster inference on CPU (ideal for AMD/Non-CUDA setups)
    whisper_model: str = "distil-large-v3"  # Options: tiny, base, small, medium, large-v3, distil-large-v3
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8081
    cors_origins: list[str] = ["*"]
    
    # File limits
    max_upload_size_mb: int = 500
    allowed_extensions: set[str] = {".mp3", ".mp4", ".wav", ".webm", ".m4a", ".mkv"}
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.download_dir.mkdir(parents=True, exist_ok=True)

# Add FFmpeg to PATH for faster-whisper and other tools
import shutil
detected_ffmpeg = shutil.which("ffmpeg")
if detected_ffmpeg:
    ffmpeg_dir = str(Path(detected_ffmpeg).parent)
elif Path(settings.ffmpeg_path).exists():
    ffmpeg_dir = str(Path(settings.ffmpeg_path).parent)
else:
    ffmpeg_dir = None
    print("WARNING: FFmpeg not found in PATH or at specified location.")

if ffmpeg_dir and ffmpeg_dir not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + ffmpeg_dir

