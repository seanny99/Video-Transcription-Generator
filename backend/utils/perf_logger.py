import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

# UTC+8 for Malaysia Time
MYT = timezone(timedelta(hours=8))

logger = logging.getLogger(__name__)

class PerformanceLogger:
    """
    Logger for tracking performance metrics and duration of processing phases.
    Uses Malaysian Time (UTC+8) for all timestamps.
    """
    
    def __init__(self):
        self._start_times: Dict[str, float] = {}

    def _get_myt_time(self) -> str:
        """Get current time in MYT formatted string."""
        return datetime.now(MYT).strftime("%Y-%m-%d %H:%M:%S")

    def start_phase(self, phase_name: str) -> None:
        """Start tracking a phase."""
        self._start_times[phase_name] = time.perf_counter()
        logger.info(f"[{self._get_myt_time()}] [START] {phase_name}")

    def end_phase(self, phase_name: str, extra_info: str = "") -> float:
        """
        End tracking a phase and log the duration.
        Returns the duration in seconds.
        """
        start_time = self._start_times.pop(phase_name, None)
        if start_time is None:
            logger.warning(f"Attempted to end phase '{phase_name}' without starting it.")
            return 0.0

        duration = time.perf_counter() - start_time
        info_str = f" - {extra_info}" if extra_info else ""
        
        logger.info(
            f"[{self._get_myt_time()}] [END]   {phase_name}{info_str} "
            f"(Duration: {duration:.3f}s)"
        )
        return duration

    def log(self, message: str) -> None:
        """Log a general message with MYT timestamp."""
        logger.info(f"[{self._get_myt_time()}] {message}")

# Singleton instance
perf_logger = PerformanceLogger()
