
import pytest
import pytest
from datetime import datetime
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app" in data

@pytest.mark.asyncio
async def test_youtube_info(client: AsyncClient, mock_external_services):
    """Test fetching YouTube video metadata."""
    url = "https://www.youtube.com/watch?v=test"
    response = await client.post("/youtube/info", json={"url": url})
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test_video_id"
    assert data["title"] == "Test Video Title"

@pytest.mark.asyncio
async def test_media_upload(client: AsyncClient, temp_dirs):
    """Test uploading a media file."""
    # Create a dummy file
    files = {"file": ("test.mp3", b"dummy audio content", "audio/mpeg")}
    
    response = await client.post("/media/upload", files=files)
    
    assert response.status_code == 200, f"Upload failed: {response.text}"
    data = response.json()
    assert data["original_filename"] == "test.mp3"
    assert "id" in data
    
    return data["id"]

@pytest.mark.asyncio
async def test_transcription_lifecycle(client: AsyncClient, temp_dirs, mock_external_services):
    """
    Test the full transcription lifecycle:
    1. Upload file
    2. Start transcription
    3. Check status
    """
    # 1. Upload
    files = {"file": ("speech.wav", b"dummy content", "audio/wav")}
    upload_res = await client.post("/media/upload", files=files)
    assert upload_res.status_code == 200
    media_id = upload_res.json()["id"]
    
    # 2. Start Transcription
    start_res = await client.post(f"/transcripts/media/{media_id}/transcribe")
    assert start_res.status_code == 200
    data = start_res.json()
    assert data["status"] == "pending"
    transcript_id = data["transcript_id"]
    
    # 3. Check Status
    # Since we mocked the worker, it won't actually process, but we can check the initial state
    status_res = await client.get(f"/transcripts/{transcript_id}/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "pending"

    # Verify generic transcript endpoint works
    details_res = await client.get(f"/transcripts/{transcript_id}")
    assert details_res.status_code == 200
    assert details_res.json()["media_id"] == media_id

@pytest.mark.asyncio
async def test_resume_functionality(client: AsyncClient, db_session, mock_external_services):
    """
    Test that the system can resume/retry a failed or stuck transcription.
    """
    from models.transcript import Transcript, TranscriptionStatus
    from models.media import MediaFile, MediaSource
    
    # 1. Setup: Create a "Stuck" transcript (simulating a crash)
    # create media
    media = MediaFile(
        filename="resume_test.mp3",
        original_filename="resume_test.mp3",
        file_path="resume_test.mp3",
        media_type="audio/mpeg",
        source=MediaSource.UPLOAD
    )
    db_session.add(media)
    await db_session.flush()
    await db_session.refresh(media)
    
    # create transcript with chunks processed but FAILED/STUCK status
    transcript = Transcript(
        media_id=media.id,
        status=TranscriptionStatus.FAILED, # User sees failed, clicks 'Retry'
        last_processed_chunk=2,
        total_chunks=5,
        error_message="Simulated Crash"
    )
    db_session.add(transcript)
    await db_session.commit()
    
    # 2. Action: User clicks "Transcribe" (Retry)
    # The backend should detect existing record and Resume
    response = await client.post(f"/transcripts/media/{media.id}/transcribe")
    assert response.status_code == 200
    
    # 3. Verify: Status is PENDING (queued) and we didn't get a 409 Conflict
    data = response.json()
    assert data["status"] == "pending"
    assert data["transcript_id"] == transcript.id
    assert data["message"] == "Transcription started"

@pytest.mark.asyncio
async def test_cancellation_flow(client: AsyncClient, db_session, mock_external_services):
    """
    Test canceling a running job.
    """
    from models.transcript import Transcript, TranscriptionStatus
    from models.media import MediaFile, MediaSource
    
    # 1. Setup: Create a "Processing" transcript
    media = MediaFile(
        filename="cancel_test.mp3",
        original_filename="cancel_test.mp3",
        file_path="cancel_test.mp3",
        media_type="audio/mpeg",
        source=MediaSource.UPLOAD
    )
    db_session.add(media)
    await db_session.flush()
    await db_session.refresh(media)
    
    transcript = Transcript(
        media_id=media.id,
        status=TranscriptionStatus.PROCESSING,
        started_at=datetime(2024, 1, 1, 0, 0, 0)
    )
    db_session.add(transcript)
    await db_session.commit()
    await db_session.refresh(transcript)
    
    # 2. Action: Call Cancel API
    response = await client.post(f"/transcripts/{transcript.id}/cancel")
    assert response.status_code == 200
    assert response.json()["message"] == "Transcription canceled"
    
    # 3. Verify: Status update in DB
    status_res = await client.get(f"/transcripts/{transcript.id}")
    assert status_res.status_code == 200
    data = status_res.json()
    assert "Canceled by user" in data["error_message"]
