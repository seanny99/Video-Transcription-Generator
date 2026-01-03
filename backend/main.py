"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import media, transcript, youtube

app = FastAPI(
    title=settings.app_name,
    description="Video/Audio transcription service with YouTube support",
    version="1.0.0"
)

# CORS middleware for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(transcript.router, prefix="/api/transcripts", tags=["Transcripts"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["YouTube"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    from models.database import init_db
    await init_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
