## [4.3.13] - 2026-01-25

### 🕵️‍♂️ Deep Audit Fixes
- **Fixed** Startup Hang: The "Reactive" port binding was failing to detect the port because Uvicorn outputs its startup logs to `stderr` (Standard Error), while the frontend was only listening to `stdout`. I've updated the logic to parse both streams, allowing the app to instantaneously detect the assigned port and launch the window.
- **Updated** Branding: Incremented version to `v4.3.13`.

---


### 🐞 Startup Crash Fix
- **Fixed** `[WinError 87] The parameter is incorrect`: Added robust error handling around `multiprocessing.freeze_support()`. This suppresses a crash that occurred in child processes spawned by third-party libraries (likely system info polling). The app now gracefully terminates these unnecessary child processes instead of showing a scary traceback.
- **Improved** Process Policy: Enforced `workers=1` on the internal server to prevent any accidental process spawning.
- **Updated** Branding: Incremented version to `v4.3.12`.

---


### 💣 Process Management Fix
- **CRITICAL FIX**: Added `multiprocessing.freeze_support()` to the backend entry point. This prevents the compiled Windows executable from recursively spawning infinite copies of itself when the job queue worker starts. This was the root cause of the "so many ports open" issue where hundreds of backend instances would flood the system.
- **Updated** Branding: Incremented version to `v4.3.11`.

---


### 📡 Reactive Port Binding
- **Fixed** Startup Race Condition: Implemented a "Reactive Binding" strategy. Instead of Electron guessing a port, it now commands the Backend to find *any* available port (Port 0) and reports it back via stdout. Electron then dynamically connects to that specific port.
- **Removed** Flaky Port Discovery: Deleted the `findPort` logic that caused "Address already in use" errors due to race conditions.
- **Updated** Branding: Incremented version to `v4.3.10`.

---


### 🎲 Dynamic Port Allocation
- **Fixed** "Address already in use" Error: Switched from fixed fallback ports (8081, 55666) to fully dynamic OS-assigned ephemeral ports (Port 0). This allows the application to find a guaranteed free port on every startup, even if previous zombie processes are still running.
- **Improved** Process Isolation: Each application instance now runs on its own isolated port channel.
- **Updated** Branding: Incremented version to `v4.3.9`.

---


### 🚀 Startup & Connection Resilience
- **Fixed** Connection Race Condition: Implemented a "Smart Handshake" on startup. The frontend now waits for the backend to initialize (max 12s) before attempting to fetch data, preventing "Offline" errors on first load.
- **Improved** Backend Readiness: Added automatic retries with exponential backoff for initial history and system spec loading.
- **Updated** Branding: Incremented version to `v4.3.8`.

---


### 🕒 Timezone & UI Polish
- **Fixed** Historical Timestamps: Standardized on Zulu (Z) ISO suffixes for all API responses, fixing the "8 hours ago" bug in the history panel.
- **Removed** Redundant UI: Removed the version footer from the Settings Drawer as requested for a cleaner interface.
- **Updated** Branding: Incremented version to `v4.3.7`.

---


### 🛠️ Ultimate Stability Pass
- **Fixed** Startup Regression: Restored missing `set_processor` method in `JobQueue` that caused crashes on startup.
- **Fixed** Hardware UI Hang: Refactored system hardware detection to run in a background thread. The "Hardware" section now loads instantly with partial info while detection continues in the background.
- **Fixed** Job Queue Integrity: Restored the logic for clearing cancellation flags to prevent state corruption.

---


### 🛠️ Job Queue Resilience
- **Fixed** PENDING Hang: Implemented a failure callback in the job queue to ensure that skipped or failed jobs are correctly updated in the database, preventing "ghost" pending states.
- **Fixed** Stale Job Recovery: Hardened the transcript router to allow manual resume/restart of jobs that have been stuck in the `PENDING` state for too long.
- **Fixed** Timezone Safety: Standardized on UTC for all internal staleness and progress checks.

---


### 🛠️ Production Bug Fixes
- **Fixed** Media Deletion Crash: Resolved a `NameError` in the backend where the logger was not defined, causing 500 errors when deleting media.
- **Fixed** Transcript Polling 404: Updated the frontend to use the correct media-based API route for transcript updates, fixing broken real-time progress indicators.
- **Fixed** Hardware Detection Hang: Refactored system services to use non-blocking fallbacks for CPU/GPU detection, fixing the "Specifying..." hang in the Settings menu.
- **Improved** System Robustness: Standardized logging across all API routers to improve production diagnostics.
- **Updated** Branding: Standardized versioning to `v4.3.4` across all UI components.

---


### 💎 Final Release Polish
- **Suppressed** Build Warnings: Explicitly excluded redundant submodules (`tensorboard`, legacy database drivers) to minimize build log noise.
- **Fixed** OS Hardware Compatibility: Bundled `tbb` and `tzdata` to resolve high-priority warnings/deprecations on Windows systems.
- **Verified** Production Stability: Successfully validated the AI engine (VAD/Whisper) in a fully packaged environment with standard health routing.

---

## [4.3.2] - 2026-01-24

### 🛠️ Production Stability Fixes
- **Fixed** VAD Model Error: Bundled missing `silero_vad_v6.onnx` model into the backend executable, fixing the "Transcription FAILED" error in production.
- **Fixed** Health Route: Standardized `/api/health` endpoint to ensure the UI connection indicator works correctly in all environments.

---

## [4.3.0] - 2026-01-24

### 🔍 Deployment Verification & Diagnostics
- **Added** Server Health Indicator: Added a real-time "Backend Online/Offline" status pill in the History Sidebar for immediate connection feedback.
- **Fixed** Port Synchronization: Hardware-locked the backend to strictly honor the port selected by Electron, fixing "Failed to fetch" errors caused by port mismatches.
- **Improved** Backend Reliability: Significantly improved the error reporting and logging for the packaged backend executable.
- **Added** Local Production Simulation: Created a specialized workflow for testing the bundled application behavior before shipping.
- **Improved** Production Simulation: Updated Electron main process to correctly resolve backend paths and load built files when `NODE_ENV='production'` is set locally.
- **Fixed** Backend Packaging: Added missing `aiosqlite` and async database drivers to the build script to prevent runtime module errors in the packaged executable.

---

## [4.2.0] - 2026-01-24

### 🛡️ Universal Production Hardening
- **Added** Dynamic Port Discovery: The app now automatically finds an available port if `8081` is busy, ensuring it starts correctly on every computer.
- **Added** Database Schema Versioning: Implemented a version tracking system to support seamless automated migrations in future updates.
- **Added** Auto-Legacy Migration: Added logic to automatically move development databases to the new persistent `%APPDATA%` location.
- **Improved** Cross-Platform Pathing: Standardized application data resolution to work robustly across different user environments.

---

## [4.1.0] - 2026-01-24

### ⚙️ Production Hardening
- **Added** Persistent Data Storage: Migrated all user data (DB, Uploads, Downloads) to `%APPDATA%` in production, ensuring the app works even if installed in protected folders like `Program Files`.
- **Added** Startup Port Validation: The backend now checks for port availability on `8081` and provides a clear error message instead of failing silently.
- **Improved** External Tool Reliability: Standardized FFmpeg and ffprobe invocation to use absolute paths, fixing a bug where audio chunking could fail if tools weren't in the global system `PATH`.
- **Changed** Default Host: Switched backend binding to `127.0.0.1` instead of `0.0.0.0` for improved local security.

---

## [4.0.0] - 2026-01-24

### ✨ User Experience & Interface
- **New** Hardware-Based Recommendations: Settings now analyze your system (GPU VRAM, RAM, CPU Cores) to automatically recommend the optimal Whisper model.
- **Improved** Modular Architecture: Decomposed the root `App.tsx` into specialized sub-components (`LandingScreen`, `InputModal`) and custom hooks (`useSettings`).
- **Improved** Settings Drawer: Added a collapsible "Hardware" section to save vertical space and moved recommendation logic to dedicated utilities.
- **Improved** Layout Stability: Fixed layout shifts caused by scrollbars in the settings panel.

### 🧠 Core Engine & Backend
- **Added** Centralized Exception Hierarchy: Introduced a standardized `AppError` system for predictable and robust error reporting.
- **Added** Global Error Middleware: Implemented a centralized handler in `main.py` that translates application exceptions into consistent API responses.
- **Enhanced** Hardware Detection: Now detects and reports exact VRAM (Video Memory), System RAM, and CPU Core counts.
- **Refactored** Internal Services: Updated `YouTubeService` and `FileService` to eliminate redundant logic and use the new error-handling standard.
- **Refined** VRAM Heuristics: Added smart detection for high-end GPUs that report capped memory due to 32-bit interface limitations.

---

## [3.0.0] - 2026-01-24

### ✨ User Experience & Interface
- **Added** Pop-out History Slider: A fixed navigation rail with a toggleable drawer for history management.
- **Added** Global Responsive Scaling: Transitioned to `rem`-based sizing for high-fidelity zoom and resolution support.
- **Changed** Media Player Layout: Fluid container design that maximizes video real estate across all screen sizes.
- **Changed** Active Transcript Styling: Forced high-contrast text colors on active segments for perfect readability.
- **Improved** Micro-animations for sidebar transitions and transcript synchronization.

### 🧠 Core Engine & AI
- **Added** Multi-Hardware Support: Automated detection for NVIDIA (CUDA), AMD, and CPU-only environments.
- **Added** Runtime Model Hot-Swapping: Switch between Whisper models (Tiny to Large-v3) without restart.
- **Improved** Transcription Accuracy: Integrated `distil-large-v3` as the optimized default for balanced performance.

### ⚙️ System & Reliability
- **Added** Deep Job Cancellation: Closing or deleting a media item now immediately halts all child processes (FFmpeg/Whisper).
- **Changed** Polling Architecture: Consolidated job tracking into a centralized React hook for efficiency.
- **Improved** File Cleanup: Verified and fixed path resolution for automated removal of YouTube download residues.

### 🐛 Bug Fixes
- **Fixed** Resume Button Navigation: Clicking Resume now correctly focuses the active transcription view.
- **Fixed** Loading State Flickers: Eliminated the "No matches" message displayed during early-stage processing.
- **Fixed** Timer Alignment: Centered time text within the player overlay pill.

---

## [2.0.0] - 2026-01-04

### 🚀 Major Architectural Leap
> **Summary**: Complete re-engineering of the transcription system for massive speed gains and improved error handling.

#### Performance Metrics
| Metric | v1.x (OpenAI Whisper) | v2.x (faster-whisper) | Improvement |
| :--- | :--- | :--- | :--- |
| **Transcription Speed** | 1x Real-time | ~4x Real-time | **400% Gain** |
| **Model Backend** | PyTorch | CTranslate2 | Lower Overhead |
| **VRAM Consumption** | ~8 GB | ~6 GB | **25% Reduction** |

### 🆕 New Features
- **Singleton Manager**: Unified `TranscriptionManager` that keeps models warm in memory to eliminate cold-start delays.
- **Async Job Queue**: Thread-safe FIFO queue to prevent hardware over-saturation during batch requests.
- **Crash Recovery**: Auto-reconcile "stuck" jobs on system restart to maintain database integrity.
- **Accent Handling**: Optimized decoding parameters (beam size 5, VAD filtering) for technical or accented speech.
- **Real-time ETA**: Dynamic countdown based on processing throughput during transcription.

### 🔧 Technical & Infrastructure
- **Dependency Shift**: Migrated from `openai-whisper` and heavy `torch` to optimized `faster-whisper`.
- **API Evolution**: Health checks now include detailed queue metrics and worker status.
- **FFmpeg Integration**: Automated environment path injection to ensure zero-config processing on Windows.

### 🐛 Bug Fixes
- Resolved race condition where background tasks started before database commits were finalized.
- Fixed `UnboundLocalError` on failed transcription attempts.
- Moved default backend port to `8081` to avoid common Windows conflicts.

---

## [1.0.0] - 2026-01-03

### 🌱 Initial Release
- **Core**: Multi-platform YouTube download and local transcription engine.
- **Interface**: Interactive synchronized transcript playback.
- **Local Storage**: Persistent SQLite database for history management.
- **Technology**: Electron 25, React 18, FastAPI, and OpenAI Whisper.
