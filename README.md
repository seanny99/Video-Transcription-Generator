# Video Transcription Generator

A Windows desktop application for video/audio transcription with YouTube URL support and synchronized playback.

## Features

- 🎬 **YouTube Support** - Paste any YouTube URL to download and transcribe
- 📁 **File Upload** - Upload MP4, MP3, WAV, WebM, M4A, or MKV files
- 🎯 **Synchronized Playback** - Transcript highlights and auto-scrolls as you watch
- 🖱️ **Click to Seek** - Click any transcript segment to jump to that time
- 🔒 **Local Processing** - Uses faster-whisper locally (no cloud API needed)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Electron + React + TypeScript |
| Backend | Python + FastAPI |
| Transcription | faster-whisper |
| YouTube | yt-dlp |
| Database | SQLite |

## Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **FFmpeg** (required for audio processing)

### Install FFmpeg (Windows)
```powershell
# Using winget
winget install ffmpeg

# Or using chocolatey
choco install ffmpeg
# Or using chocolatey
choco install ffmpeg
```

### Performance Note (AMD / Intel GPU Users)
This application uses `faster-whisper`.
- **NVIDIA GPUs**: Will automatically use CUDA for maximum speed.
- **AMD/Intel GPUs**: Will run on **CPU**. To ensure fast performance, we default to the `distil-large-v3` model, which is ~6x faster than standard large-v3 while maintaining high accuracy.

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/Video-Transcription-Generator.git
cd Video-Transcription-Generator
```

### 2. Set up Backend
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Set up Frontend
```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Start Backend:**
```bash
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8081
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Start Electron:**
```bash
cd frontend
npm run electron
```

### Production Build
```bash
cd frontend
npm run build
npm run package
```

## Project Structure

```
Video-Transcription-Generator/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Configuration
│   ├── models/              # Database models
│   ├── services/            # Business logic
│   ├── routers/             # API endpoints
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── main/            # Electron main process
│   │   └── renderer/        # React application
│   ├── package.json
│   └── vite.config.ts
│
├── PROGRAMMING_PRACTICES.md # Coding standards
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/youtube/info` | POST | Get YouTube video metadata |
| `/api/youtube/download` | POST | Download and transcribe YouTube video |
| `/api/media/upload` | POST | Upload media file |
| `/api/media/{id}/stream` | GET | Stream media for playback |
| `/api/transcripts/media/{id}` | GET | Get transcript for media |
| `/api/transcripts/{id}/status` | GET | Poll transcription status |

## Configuration

Create a `.env` file in the `backend/` directory:

```env
# Whisper model: tiny, base, small, medium, large
WHISPER_MODEL=base

# Server settings
HOST=127.0.0.1
PORT=8000

# File limits
MAX_UPLOAD_SIZE_MB=500
```

## License

MIT License