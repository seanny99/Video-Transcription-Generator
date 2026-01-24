# System Architecture

## Overview
The **Video Transcription Generator** is a local desktop application that downloads videos (YouTube) or accepts file uploads, and uses local AI models (Whisper) to generate accurate text transcriptions. It is designed for privacy and performance, leveraging local hardware acceleration where available.

## Technology Stack

### Frontend (The UI)
- **Framework**: React 18 (TypeScript)
- **Build Tool**: Vite
- **Wrapper**: Electron (for desktop integration)
- **Styling**: Vanilla CSS + Tailwind (Utility-first framework)
- **Components**: Framer Motion (Animations), Lucide (Icons)
- **Unit System**: `rem`-based relative scaling (supports accessible zoom)
- **Communication**: Fetch API (HTTP) via standardized `ApiClient` with custom `ApiError` handling
- **State Management**: Specialized hooks (`useSettings`, `useTranscriptSync`, `useTranscriptPoller`)

### Backend (The Brain)
- **Framework**: FastAPI (Python 3.11+)
- **Server**: Uvicorn (ASGI)
- **Database**: SQLite (Async via `aiosqlite` + `SQLAlchemy 2.0`)
- **Job Management**: Internal `JobQueue` with thread-safe cancellation support
- **Hardware Integration**: `SystemService` for real-time detection of CPU, GPU, RAM, VRAM, and Cores (PowerShell/WMIC on Windows).
- **Error Handling**: Centralized `AppError` hierarchy with global middleware for consistent API responses.

### AI & Media Processing
- **Downloader**: `yt-dlp` (YouTube video extraction)
- **Transcriber**: `faster-whisper` (Optimized Local Speech-to-Text model)
- **Media Processor**: `FFmpeg` (Audio conversion/extraction)

---

## Data Flow: From URL to Transcript

The application follows an **Asynchronous Architecture** to handle long-running tasks without freezing the UI.

### 1. User Input & Validation
- User pastes a URL or uploads a file via `MediaInput`.
- Frontend calls `[GET] /api/system/specs` to show user hardware (RAM, VRAM, GPU, Cores) and recommended model.

### 2. Request Initiation
- User clicks "Transcribe".
- Frontend calls the appropriate download/upload endpoint.
- **Backend Action**:
    1.  Validates file/URL.
    2.  Creates a **MediaFile** record and a **Transcript** record with status `PENDING`.
    3.  Adds the job to the `JobQueue`.
    4.  Returns `media_id` immediately.
- **Frontend Response**: The UI switches to the "Transcribing..." view.

### 3. Background Processing (The Heavy Lifting)
- The `TranscriptionManager` handles the lifecycle:
    1.  **Hardware Check**: Selects `cuda` (NVIDIA) or `cpu` based on `SystemService`. Recommends models based on VRAM/RAM capacity.
    2.  **Audio Extraction**: FFmpeg converts source to 16kHz WAV.
    3.  **Dynamic Whisper**: Loads the model selected in Settings (e.g., `distil-large-v3`).
    4.  **Status Sync**: Updates DB at every step (Extracting -> Transcribing -> Completed).

### 4. Polling & Job Lifecycle
- **Real-time Updates**: The Frontend uses a custom hook `useTranscriptPoller` in `App.tsx`. It polls the backend result every 2s while a job is active.
- **Robustness**: If a 404 is detected (e.g., item deleted elsewhere), the poller automatically stops and clears the view.
- **Cancellation**: Deleting a media item calls `JobQueue.cancel_job()`, which halts the active FFmpeg or Whisper process immediately to free up system resources.

---

## Directory Structure
```
/
├── backend/               # Python FastAPI Server
│   ├── models/            # Database definitions (SQLAlchemy)
│   ├── routers/           # API Endpoints (/youtube, /media, /transcripts, /config)
│   ├── services/          # Business Logic (system_service, transcription_manager)
│   ├── utils/             # Utilities (exceptions.py, logging)
│   ├── config.py          # Settings & Runtime Path Injections
│   └── main.py            # Entry point & App Factory
│
├── frontend/              # Electron + React App
│   ├── src/
│   │   ├── main/          # Electron Main Process (Node.js)
│   │   └── renderer/      # React App
│   │       ├── components/# UI Components (Modular decomposition: LandingScreen, InputModal, TranscriptPanel)
│   │       ├── hooks/     # Custom hooks (useSettings, useTranscriptSync, useTranscriptPoller)
│   │       ├── services/  # API wrappers (standardized ApiClient)
│   │       ├── types/     # Shared Type definitions & Enums
│   │       └── utils/     # Shared logic (transcriptUtils, settingsUtils)
```

## Key Configuration Details
- **Production Persistence**: In packaged mode, the app uses `%APPDATA%/VideoTranscriptionGenerator` for all database, upload, and download storage to avoid write-permission issues in system directories.
- **Tool Path Standardization**: Dynamically detects and verifies FFmpeg/ffprobe paths, ensuring consistent subprocess execution across different user environments.
- **Port Resilience**: Implements an explicit port check at startup to prevent silent failures caused by port conflicts on `8081`.
- **Hardware Awareness**: FFmpeg and Whisper paths are managed dynamically. On Windows, the app audits `winget` and standard NVIDIA paths to ensure tools are found without user configuration.
- **Security Logic**: Content Security Policy (CSP) is configured to allow `ws:` for Vite HMR and `stream:` for local media playback.
- **Responsive Navigation**: The main container is fluid, adapting to resolutions from 720p to 4K. The `HistorySidebar` is a fixed-rail overlay that pops out to save screen real estate.
- **Context Preservation**: User settings (Theme, Zoom, Selected Model) are persisted in `localStorage`.
