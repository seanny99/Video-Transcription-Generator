import platform
import logging
import cpuinfo
import json
import os
from pathlib import Path
from typing import Dict, Any

from config import settings

logger = logging.getLogger(__name__)

# DEBUG: File Logger
# We use a hardcoded path in AppData to ensure it writes even if config fails
app_data = Path(os.environ.get('APPDATA', '.')) / "VideoTranscriptionGenerator"
app_data.mkdir(parents=True, exist_ok=True)
debug_log = app_data / "hardware_debug.log"

def log_debug(msg):
    try:
        with open(debug_log, "a") as f:
            f.write(f"{msg}\n")
    except: pass

class SystemService:
    """
    Service for partial hardware detection and configuration management.
    """
    
    SETTINGS_FILE = Path(settings.base_dir) / "user_settings.json"
    
    def __init__(self):
        self._hardware_info = {
            "cpu": platform.processor() or "Detecting...",
            "gpu": "Detecting...",
            "os": f"{platform.system()} {platform.release()}",
            "arch": platform.machine(),
            "ram": 0.0, "vram": 0.0, "cores": 0, "threads": 0
        }
        self._ensure_settings_file()
        import threading
        threading.Thread(target=self._background_detection, daemon=True).start()

    def _ensure_settings_file(self):
        """Create settings file if not exists."""
        if not self.SETTINGS_FILE.exists():
            default_settings = {
                "whisper_model": settings.whisper_model 
            }
            self.save_settings(default_settings)

    def _background_detection(self):
        """Perform hardware detection in background thread."""
        log_debug("Starting background hardware detection...")
        try:
            import cpuinfo
            log_debug("cpuinfo imported")
            # CPU Name (Brand Raw is usually best)
            try: 
                import subprocess
                # Use standard Windows command to get CPU name safely
                if platform.system() == "Windows":
                    res = subprocess.check_output("wmic cpu get name /Value", shell=True, timeout=2).decode()
                    for line in res.splitlines():
                        if "=" in line:
                            val = line.split("=")[1].strip()
                            if val: 
                                self._hardware_info["cpu"] = val
                                log_debug(f"CPU Name (WMIC): {val}")
                                break
            except Exception as e:
                log_debug(f"CPU WMI failed: {e}")
            
            # Psutil for RAM and CPU Cores (Robust)
            try:
                import psutil
                log_debug("psutil imported")
                self._hardware_info["ram"] = round(psutil.virtual_memory().total / (1024**3), 1)
                self._hardware_info["cores"] = psutil.cpu_count(logical=False) or 4
                self._hardware_info["threads"] = psutil.cpu_count(logical=True) or 4
                log_debug(f"RAM: {self._hardware_info['ram']}, Cores: {self._hardware_info['cores']}")
            except ImportError as e:
                log_debug(f"psutil import failed: {e}")
                logger.warning("psutil not installed, RAM/Core detection may be inaccurate")
            except Exception as e:
                log_debug(f"psutil logic failed: {e}")
                logger.warning(f"psutil detection failed: {e}")

            # Windows GPU Detection (Improved WMI)
            if platform.system() == "Windows":
                try:
                    import subprocess
                    # GPU Name: Get all controllers and pick the best one
                    res = subprocess.check_output("wmic path win32_VideoController get name /Value", shell=True, timeout=5).decode()
                    gpus = []
                    for line in res.splitlines():
                        if "=" in line:
                            val = line.split("=")[1].strip()
                            if val: gpus.append(val)
                    
                    # Filter logic: Prefer dedicated GPUs over 'Microsoft Basic' or 'Intel UHD' if multiple
                    if gpus:
                        best_gpu = gpus[0]
                        for g in gpus:
                            if "nvidia" in g.lower() or "amd" in g.lower() or "radeon" in g.lower() or "geforce" in g.lower():
                                best_gpu = g
                        self._hardware_info["gpu"] = best_gpu
                    else:
                        self._hardware_info["gpu"] = "Unknown GPU"

                    # VRAM (Max of all adapters)
                    res = subprocess.check_output("wmic path Win32_VideoController get AdapterRAM /Value", shell=True, timeout=5).decode()
                    max_vram = 0.0
                    for line in res.splitlines():
                        if "=" in line:
                            try:
                                bytes_val = int(line.split("=")[1].strip())
                                # Filter out negative/overflow values sometimes returned by WMI
                                if bytes_val > 0:
                                    max_vram = max(max_vram, round(bytes_val / (1024**3), 1))
                            except: pass
                    self._hardware_info["vram"] = max_vram
                except Exception as e:
                   logger.warning(f"WMI GPU detection failed: {e}")
                   self._hardware_info["gpu"] = "Detection Failed"
        except Exception as e:
            logger.error(f"Hardware detection crashed: {e}")


    def get_hardware_info(self) -> Dict[str, Any]:
        """Return cached info instantly."""
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
