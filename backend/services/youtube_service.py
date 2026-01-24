"""
YouTube download service using yt-dlp.
Downloads videos/audio from YouTube URLs.
"""

import re
import uuid
import logging
from pathlib import Path
from typing import Optional
import yt_dlp

from config import settings
from utils.exceptions import ValidationError, ProcessingError

logger = logging.getLogger(__name__)


# Removed local exception classes, using utils.exceptions instead


class YouTubeService:
    """Service for downloading videos from YouTube."""
    
    YOUTUBE_REGEX = re.compile(
        r'(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+'
    )
    
    # Patterns that indicate playlist URLs
    PLAYLIST_PATTERNS = [
        r'[?&]list=',           # Regular playlist parameter
        r'/playlist\?',          # Playlist page
        r'youtube\.com/c/',      # Channel page
        r'youtube\.com/channel/', # Channel page
        r'youtube\.com/@',        # Handle page
    ]
    
    def __init__(self):
        self.download_dir = settings.download_dir
        
    def validate_url(self, url: str) -> bool:
        """Check if URL is a valid YouTube URL."""
        return bool(self.YOUTUBE_REGEX.match(url))
    
    def is_playlist_url(self, url: str) -> bool:
        """Check if URL is a playlist, channel, or mix."""
        for pattern in self.PLAYLIST_PATTERNS:
            if re.search(pattern, url):
                return True
        return False
    
    def get_video_info(self, url: str) -> dict:
        """
        Get video metadata without downloading.
        
        Returns:
            Dict with title, duration, thumbnail, etc.
        """
        if not self.validate_url(url):
            raise ValidationError(f"Invalid YouTube URL: {url}")
        
        # Reject playlist URLs
        if self.is_playlist_url(url):
            raise ValidationError(
                "Playlist URLs are not supported. Please paste a single video URL "
                "(remove '&list=...' from the URL if present)"
            )
        
        ydl_opts = {
            'quiet': False,
            'no_warnings': False,
            'extract_flat': False,
            'noplaylist': True,  # Never download playlists
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'id': info.get('id'),
                    'title': info.get('title'),
                    'duration': info.get('duration'),
                    'thumbnail': info.get('thumbnail'),
                    'uploader': info.get('uploader'),
                }
        except Exception as e:
            logger.error(f"Failed to get video info: {e}")
            raise ProcessingError(f"Could not fetch video info: {str(e)}")
    
    def download_video(
        self,
        url: str,
        extract_audio: bool = False,
        progress_callback: Optional[callable] = None
    ) -> dict:
        """
        Download video from YouTube.
        
        Args:
            url: YouTube URL
            extract_audio: If True, extract audio only (mp3)
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict with file_path, title, and other metadata
        """
        if not self.validate_url(url):
            raise ValidationError(f"Invalid YouTube URL: {url}")
        
        # Reject playlist URLs
        if self.is_playlist_url(url):
            raise ValidationError(
                "Playlist URLs are not supported. Please paste a single video URL "
                "(remove '&list=...' from the URL if present)"
            )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())[:8]
        output_template = str(self.download_dir / f"{file_id}_%(title)s.%(ext)s")
        
        ydl_opts = {
            'outtmpl': output_template,
            'quiet': False,
            'no_warnings': False,
            'ffmpeg_location': settings.ffmpeg_path,
            'noplaylist': True,  # Never download playlists
        }
        
        if extract_audio:
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        
        if progress_callback:
            def progress_hook(d):
                if d['status'] == 'downloading':
                    progress = d.get('_percent_str', 'N/A')
                    progress_callback({'status': 'downloading', 'progress': progress})
                elif d['status'] == 'finished':
                    progress_callback({'status': 'finished'})
            
            ydl_opts['progress_hooks'] = [progress_hook]
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # Get the actual downloaded file path
                if extract_audio:
                    ext = 'mp3'
                else:
                    ext = info.get('ext', 'mp4')
                
                filename = ydl.prepare_filename(info)
                if extract_audio:
                    filename = filename.rsplit('.', 1)[0] + '.mp3'
                
                return {
                    'file_path': str(Path(filename).resolve()),
                    'filename': Path(filename).name,
                    'title': info.get('title'),
                    'duration': info.get('duration'),
                    'source_url': url,
                    'media_type': 'audio/mp3' if extract_audio else 'video/mp4',
                }
                
        except yt_dlp.DownloadError as e:
            logger.error(f"Download failed: {e}")
            raise ProcessingError(f"Failed to download video: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during download: {e}")
            raise ProcessingError(f"Download failed: {str(e)}")
