"""
Media file database model.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
import enum

from models.database import Base


class MediaSource(enum.Enum):
    """Source of the media file."""
    UPLOAD = "upload"
    YOUTUBE = "youtube"


class MediaFile(Base):
    """Uploaded or downloaded media file metadata."""
    
    __tablename__ = "media_files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    media_type = Column(String(50), nullable=False)  # video/mp4, audio/mp3, etc.
    source = Column(Enum(MediaSource), default=MediaSource.UPLOAD)
    source_url = Column(String(500), nullable=True)  # YouTube URL if applicable
    title = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    transcript = relationship("Transcript", back_populates="media", uselist=False)
