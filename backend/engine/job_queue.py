"""
Async job queue for transcription processing.
Implements single-worker concurrency to prevent VRAM overflow.
"""

import asyncio
import logging
from typing import Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class TranscriptionJob:
    """A job in the transcription queue."""
    media_id: int
    file_path: str
    initial_prompt: Optional[str] = None
    language: Optional[str] = None
    enqueued_at: datetime = field(default_factory=datetime.utcnow)


class JobQueue:
    """
    Async job queue with single-worker concurrency.
    
    Ensures only one transcription runs at a time to prevent
    GPU VRAM overflow when using large models.
    """
    
    _instance: Optional["JobQueue"] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._queue: asyncio.Queue[TranscriptionJob] = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._processor: Optional[Callable[[TranscriptionJob], Awaitable[None]]] = None
        self._on_failure: Optional[Callable[[TranscriptionJob, str], Awaitable[None]]] = None
        self._running = False
        self._initialized = True
        self._cancelled_ids = set()
        self._current_job: Optional[TranscriptionJob] = None
        
    @classmethod
    def get_instance(cls) -> "JobQueue":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def cancel_job(self, media_id: int) -> None:
        """
        Mark a job as cancelled.
        If it's in the queue, it will be skipped when popped.
        If it's running, is_cancelled() will return True.
        """
        self._cancelled_ids.add(media_id)
        logger.info(f"Job marked for cancellation: media_id={media_id}")

    def is_cancelled(self, media_id: int) -> bool:
        """Check if a job has been cancelled."""
        return media_id in self._cancelled_ids

    def clear_cancelled(self, media_id: int) -> None:
        """Cleanup cancellation flag after job is done/skipped."""
        if media_id in self._cancelled_ids:
            self._cancelled_ids.remove(media_id)

    def set_processor(self, processor: Callable[[TranscriptionJob], Awaitable[None]]) -> None:
        """
        Set the async function that processes each job.
        
        Args:
            processor: Async function that takes a TranscriptionJob
        """
        self._processor = processor
    
    def set_on_failure(self, on_failure: Callable[[TranscriptionJob, str], Awaitable[None]]) -> None:
        """Set callback for job failures or skips."""
        self._on_failure = on_failure
    
    async def enqueue(self, job: TranscriptionJob) -> None:
        """Add a job to the queue."""
        await self._queue.put(job)
        logger.info(f"Job enqueued: media_id={job.media_id}, queue_size={self._queue.qsize()}")
    
    async def start_worker(self) -> None:
        """Start the background worker loop."""
        if self._running:
            logger.warning("Worker already running")
            return
            
        if self._processor is None:
            raise RuntimeError("No processor set. Call set_processor() first.")
        
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Job queue worker started (concurrency=1)")
    
    async def stop_worker(self, wait_for_current: bool = True) -> None:
        """
        Stop the worker loop.
        
        Args:
            wait_for_current: If True, wait for current job to finish
        """
        self._running = False
        
        if wait_for_current and self._worker_task:
            # Put a sentinel to unblock the queue
            await self._queue.put(None)
            await self._worker_task
            
        logger.info("Job queue worker stopped")
    
    async def _worker_loop(self) -> None:
        """Main worker loop - processes one job at a time."""
        while self._running:
            try:
                # Wait for next job (blocking)
                job = await self._queue.get()
                
                # Sentinel value means shutdown
                if job is None:
                    self._queue.task_done()
                    break
                
                logger.info(f"Processing job: media_id={job.media_id}")
                self._current_job = job
                
                # Check if cancelled while in queue
                if self.is_cancelled(job.media_id):
                    logger.info(f"Skipping cancelled job: media_id={job.media_id}")
                    if self._on_failure:
                        await self._on_failure(job, "Cancelled before processing")
                    self.clear_cancelled(job.media_id)
                    self._queue.task_done()
                    self._current_job = None
                    continue

                try:
                    await self._processor(job)
                except Exception as e:
                    logger.error(f"Job failed: media_id={job.media_id}, error={e}")
                finally:
                    self.clear_cancelled(job.media_id)
                    self._queue.task_done()
                    self._current_job = None
                    
            except asyncio.CancelledError:
                logger.info("Worker cancelled")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
    
    @property
    def queue_size(self) -> int:
        """Current number of jobs waiting."""
        return self._queue.qsize()
    
    @property
    def is_running(self) -> bool:
        """Whether the worker is running."""
        return self._running


async def enqueue_transcription(
    media_id: int,
    file_path: str,
    initial_prompt: Optional[str] = None,
    language: Optional[str] = None
) -> None:
    """
    Enqueue a transcription job.
    
    This is the main entry point for adding transcription work.
    """
    job = TranscriptionJob(
        media_id=media_id,
        file_path=file_path,
        initial_prompt=initial_prompt,
        language=language
    )
    queue = JobQueue.get_instance()
    await queue.enqueue(job)
