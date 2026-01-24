"""
Application configuration management.
Centralizes all configuration settings for the transcription service.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


import sys
import shutil

def get_app_data_dir() -> Path:
    """Get persistent application data directory."""
    if getattr(sys, 'frozen', False):
        # Production: %APPDATA%/VideoTranscriptionGenerator
        app_data = Path(os.getenv('APPDATA', os.path.expanduser('~'))) / "VideoTranscriptionGenerator"
        app_data.mkdir(parents=True, exist_ok=True)
        return app_data
    # Development: Project root
    return Path(__file__).parent

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "Video Transcription Generator"
    debug: bool = False
    
    # Paths
    base_dir: Path = get_app_data_dir()
    upload_dir: Path = base_dir / "uploads"
    download_dir: Path = base_dir / "downloads"
    database_url: str = f"sqlite:///{base_dir / 'transcripts.db'}"
    
    # FFmpeg auto-detection with fallback
    # We'll use shutil.which for clean detection in production
    ffmpeg_path: str = shutil.which("ffmpeg") or os.getenv(
        "FFMPEG_PATH", 
        r"C:\Users\seany\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
    )
    
    ffprobe_path: str = shutil.which("ffprobe") or ffmpeg_path.replace("ffmpeg.exe", "ffprobe.exe") if ffmpeg_path else "ffprobe"

    # Transcription (faster-whisper)
    whisper_model: str = "distil-large-v3"
    
    # Server
    host: str = "127.0.0.1" # Standardized to localhost for safety
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

# Add FFmpeg to PATH for faster-whisper and other engines
if settings.ffmpeg_path:
    ffmpeg_dir = str(Path(settings.ffmpeg_path).parent)
    if ffmpeg_dir not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + ffmpeg_dir

