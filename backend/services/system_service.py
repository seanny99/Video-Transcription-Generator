import platform
import logging
import cpuinfo
import json
import os
from pathlib import Path
from typing import Dict, Any

from config import settings

logger = logging.getLogger(__name__)

class SystemService:
    """
    Service for partial hardware detection and configuration management.
    """
    
    SETTINGS_FILE = Path(settings.base_dir) / "user_settings.json"
    
    def __init__(self):
        self._hardware_info = None
        self._ensure_settings_file()

    def _ensure_settings_file(self):
        """Create settings file if not exists."""
        if not self.SETTINGS_FILE.exists():
            default_settings = {
                "whisper_model": settings.whisper_model 
            }
            self.save_settings(default_settings)

    def get_hardware_info(self) -> Dict[str, Any]:
        """Detect CPU and GPU info."""
        if self._hardware_info:
            return self._hardware_info
            
        cpu_info = cpuinfo.get_cpu_info()
        cpu_name = cpu_info.get('brand_raw', platform.processor())
        
        # Enhanced GPU detection
        gpu_name = "Integrated / Unknown"
        
        try:
            if platform.system() == "Windows":
                # Use WMIC on Windows
                import subprocess
                cmd = "wmic path win32_VideoController get name"
                result = subprocess.check_output(cmd, shell=True).decode().strip()
                # Output is: "Name\nAMD Radeon RX 7800 XT"
                lines = [line.strip() for line in result.splitlines() if line.strip() and "Name" not in line]
                if lines:
                    gpu_name = ", ".join(lines)
            elif platform.system() == "Linux":
                # Use lspci on Linux
                import subprocess
                cmd = "lspci | grep -i vga"
                result = subprocess.check_output(cmd, shell=True).decode().strip()
                if result:
                    # Extract name after colon
                    parts = result.split(':')
                    if len(parts) > 2:
                        gpu_name = parts[-1].strip()
                    else:
                        gpu_name = result
        except Exception as e:
            logger.warning(f"GPU detection failed: {e}")

        # Fallback to simple nvidia-smi check if still unknown
        if gpu_name == "Integrated / Unknown":
            import shutil
            if shutil.which("nvidia-smi"):
                gpu_name = "NVIDIA Tensor Core GPU (Detected)"
        
        self._hardware_info = {
            "cpu": cpu_name,
            "gpu": gpu_name,
            "os": f"{platform.system()} {platform.release()}",
            "arch": platform.machine()
        }
        return self._hardware_info

    def get_settings(self) -> Dict[str, Any]:
        """Load user settings."""
        try:
            if self.SETTINGS_FILE.exists():
                with open(self.SETTINGS_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")
        return {"whisper_model": settings.whisper_model}

    def save_settings(self, new_settings: Dict[str, Any]):
        """Save user settings."""
        try:
            current = self.get_settings()
            current.update(new_settings)
            with open(self.SETTINGS_FILE, 'w') as f:
                json.dump(current, f, indent=4)
            
            # Update runtime config if model changed
            if "whisper_model" in new_settings:
                settings.whisper_model = new_settings["whisper_model"]
                
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")
            raise RuntimeError(f"Could not save settings: {str(e)}")

system_service = SystemService()
