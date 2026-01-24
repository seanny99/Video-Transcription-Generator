# Changelog

All notable changes to the **Video Transcription Generator** are documented here. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
