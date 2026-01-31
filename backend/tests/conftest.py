
import pytest
import pytest_asyncio
import tempfile
import shutil
import os
from unittest.mock import MagicMock, patch
from typing import AsyncGenerator, Generator

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from models.database import Base, get_db
from config import settings

# --- Mock Services ---
# Mock external services before they are imported/used
@pytest.fixture(autouse=True)
def mock_external_services():
    with patch("engine.job_queue.JobQueue.start_worker"), \
         patch("engine.transcription_manager.TranscriptionManager._load_model"), \
         patch("yt_dlp.YoutubeDL") as mock_ytdl:
        
        mock_instance = mock_ytdl.return_value
        mock_instance.__enter__.return_value = mock_instance
        mock_instance.extract_info.return_value = {
            "id": "test_video_id",
            "title": "Test Video Title",
            "thumbnail": "http://example.com/thumb.jpg",
            "uploader": "Test Uploader",
            "duration": 120,
            "ext": "mp4"
        }
        yield mock_ytdl

# --- Database Setup ---
# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(expire_on_commit=False, bind=engine)

@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def db_session(init_db) -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session

# --- Dependency Override ---
async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

from httpx import AsyncClient, ASGITransport

# --- Client Setup ---
@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

# --- File System Mocking ---
@pytest.fixture(scope="function")
def temp_dirs():
    # Create temp directories for uploads/downloads
    with tempfile.TemporaryDirectory() as temp_dir:
        settings.upload_dir = temp_dir + "/uploads"
        settings.download_dir = temp_dir + "/downloads"
        os.makedirs(settings.upload_dir)
        os.makedirs(settings.download_dir)
        yield
        # Cleanup handled by TemporaryDirectory
