"""
Transcript database models.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from models.database import Base


class TranscriptionStatus(enum.Enum):
    """Status of a transcription job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Transcript(Base):
    """Transcript metadata and content."""
    
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_files.id"), nullable=False)
    status = Column(Enum(TranscriptionStatus), default=TranscriptionStatus.PENDING)
    full_text = Column(Text, nullable=True)
    language = Column(String(10), default="en")
    duration_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    media = relationship("MediaFile", back_populates="transcript")
    segments = relationship("TranscriptSegment", back_populates="transcript", cascade="all, delete-orphan")


class TranscriptSegment(Base):
    """Individual segment of a transcript with timing."""
    
    __tablename__ = "transcript_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id"), nullable=False)
    start_time = Column(Float, nullable=False)  # seconds
    end_time = Column(Float, nullable=False)    # seconds
    text = Column(Text, nullable=False)
    
    # Relationships
    transcript = relationship("Transcript", back_populates="segments")
