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
        
        # Enhanced Hardware Detection
        # 1. CPU Cores
        try:
            import psutil
            cpu_cores = psutil.cpu_count(logical=False)
            if not cpu_cores:
                cpu_cores = psutil.cpu_count(logical=True)
        except ImportError:
            # Fallback for Windows without psutil
            if platform.system() == "Windows":
                try:
                    import subprocess
                    # Use /Value for cleaner output "NumberOfCores=6"
                    cmd = "wmic cpu get NumberOfCores /Value"
                    result = subprocess.check_output(cmd, shell=True).decode().strip()
                    
                    found = False
                    for line in result.splitlines():
                        if "NumberOfCores" in line and "=" in line:
                            val = line.split("=")[1].strip()
                            if val.isdigit():
                                cpu_cores = int(val)
                                found = True
                                break
                    
                    if not found:
                         # Fallback if wmic gives output but parsing fails
                         import multiprocessing
                         cpu_cores = max(2, multiprocessing.cpu_count() // 2)
                except Exception as e:
                    logger.warning(f"Core detection failed: {e}")
                    import multiprocessing
                    # Fallback to logical/2 (Heuristic for HT/SMT) to avoid showing thread count
                    cpu_cores = max(2, multiprocessing.cpu_count() // 2)
            else:
                import multiprocessing
                cpu_cores = multiprocessing.cpu_count()

        # 2. System RAM (Total Physical Memory)
        ram_gb = 0.0
        try:
            if platform.system() == "Windows":
                 # Use WMIC (more reliable than Powershell regarding headers/permissions)
                import subprocess
                cmd = "wmic computersystem get TotalPhysicalMemory"
                result = subprocess.check_output(cmd, shell=True).decode().strip()
                # Output: "TotalPhysicalMemory\n17112345678"
                for line in result.splitlines():
                    if line.strip().isdigit():
                        ram_gb = round(int(line.strip()) / (1024**3), 1)
                        break
            else:
                 # Linux fallback
                with open('/proc/meminfo', 'r') as mem:
                    for line in mem:
                        if "MemTotal" in line:
                            kb = int(line.split()[1])
                            ram_gb = round(kb / (1024**2), 1)
                            break
        except Exception as e:
            logger.warning(f"RAM detection failed: {e}")

        # 3. GPU VRAM (Dedicated Video Memory)
        vram_gb = 0.0
        
        # Enhanced GPU detection
        gpu_name = "Integrated / Unknown"
        
        try:
            if platform.system() == "Windows":
                # Use WMIC/PowerShell on Windows
                import subprocess
                
                # Get Name
                cmd_name = "wmic path win32_VideoController get name"
                name_result = subprocess.check_output(cmd_name, shell=True).decode().strip()
                lines = [line.strip() for line in name_result.splitlines() if line.strip() and "Name" not in line]
                if lines:
                    gpu_name = ", ".join(lines)

                # Get VRAM
                # Note: Win32_VideoController AdapterRAM is a UInt32, capping at 4GB (4294967296 bytes).
                # If we get exactly 4GB, it might be an overflow, but it's the best we can do without external deps.
                cmd_vram = "wmic path Win32_VideoController get AdapterRAM"
                try:
                    vram_result = subprocess.check_output(cmd_vram, shell=True).decode().strip()
                    vram_bytes = 0
                    for line in vram_result.splitlines():
                        if line.strip().isdigit():
                            v = int(line.strip())
                            if v > vram_bytes:
                                vram_bytes = v
                    
                    if vram_bytes > 0:
                        vram_gb = round(vram_bytes / (1024**3), 1)
                        
                        # Heuristic for 32-bit overflow (common on powerful cards like RX 7800 XT)
                        # If exactly 4.0 GB and name indicates high-end, assume 8GB+ for recommendation safety
                        if vram_gb == 4.0 and any(x in gpu_name.upper() for x in ["RX ", "RTX ", "GTX 1080", "GTX 1081", "XT"]):
                             logger.info("VRAM capped at 4GB but high-end GPU detected. Treating as high VRAM.")
                             vram_gb = 8.0 # Boost to safe threshold for large models
                except Exception as ve:
                    logger.warning(f"VRAM detection failed: {ve}")

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
                
                # Try to get VRAM via nvidia-smi if available
                import shutil
                if shutil.which("nvidia-smi"):
                     try:
                        cmd_vram = "nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits"
                        v_out = subprocess.check_output(cmd_vram, shell=True).decode().strip()
                        if v_out.isdigit():
                            vram_gb = round(int(v_out) / 1024, 1) # nvidia-smi returns MiB
                     except:
                        pass

        except Exception as e:
            logger.warning(f"GPU detection failed: {e}")

        # Fallback to simple nvidia-smi check if still unknown
        if gpu_name == "Integrated / Unknown":
            import shutil
            if shutil.which("nvidia-smi"):
                gpu_name = "NVIDIA Tensor Core GPU (Detected)"
        
        # 4. CPU Threads Used (Display Total)
        # Backend transcription_manager handles the 70% optimization internally.
        total_cores = os.cpu_count() or 4

        self._hardware_info = {
            "cpu": cpu_name,
            "gpu": gpu_name,
            "os": f"{platform.system()} {platform.release()}",
            "arch": platform.machine(),
            "ram": ram_gb, # New
            "vram": vram_gb, # New
            "cores": cpu_cores, # New
            "threads": total_cores # New
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
