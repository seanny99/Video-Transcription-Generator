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
    DOWNLOADING = "downloading" # <--- New Status
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class Transcript(Base):
    """Transcript metadata and content."""
    
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_files.id"), nullable=False)
    status = Column(Enum(TranscriptionStatus), default=TranscriptionStatus.PENDING, index=True)
    full_text = Column(Text, nullable=True)
    language = Column(String(10), default="en")
    duration_seconds = Column(Float, nullable=True)
    estimated_seconds = Column(Float, nullable=True)  # ETA for transcription
    download_progress = Column(Float, default=0.0)    # <--- New Progress Field
    started_at = Column(DateTime, nullable=True)  # When processing started
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Chunk-based transcription tracking for resume capability
    last_processed_chunk = Column(Integer, default=0)  # Index of last completed chunk (0 = none)
    total_chunks = Column(Integer, nullable=True)      # Total chunks for this file
    
    # Relationships
    media = relationship("MediaFile", back_populates="transcript")
    segments = relationship("TranscriptSegment", back_populates="transcript", cascade="all, delete-orphan")

    @property
    def remaining_seconds(self) -> float:
        """Calculate estimated remaining seconds if processing."""
        if self.status == TranscriptionStatus.PROCESSING and self.started_at and self.estimated_seconds:
            elapsed = (datetime.utcnow() - self.started_at).total_seconds()
            return max(0, self.estimated_seconds - elapsed)
        return 0.0


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
