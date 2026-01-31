
import sys
import os
import time

# Add backend to path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from services.system_service import system_service

def verify_system_service():
    print("=== VERIFYING SYSTEM SERVICE ===")
    
    # Give the thread a moment to run
    print("Waiting for background detection (2s)...")
    time.sleep(2)
    
    info = system_service.get_hardware_info()
    
    print("\n[Hardware Info Retrieved]")
    for key, val in info.items():
        print(f"{key}: {val}")
        
    print("\nchecks:")
    print(f"RAM > 0: {'PASS' if info['ram'] > 0 else 'FAIL'}")
    print(f"Cores > 0: {'PASS' if info['cores'] > 0 else 'FAIL'}")
    print(f"GPU != Detecting...: {'PASS' if info['gpu'] != 'Detecting...' else 'FAIL'}")
    
    print("=== END VERIFICATION ===")

if __name__ == "__main__":
    verify_system_service()
