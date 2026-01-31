import pytest
from httpx import AsyncClient
from models.transcript import Transcript, TranscriptionStatus
from models.media import MediaFile, MediaSource

@pytest.mark.asyncio
async def test_get_system_specs(client: AsyncClient):
    """Test fetching system hardware specifications."""
    response = await client.get("/system/specs")
    assert response.status_code == 200
    data = response.json()
    assert "cpu" in data
    assert "ram" in data
    assert "os" in data

@pytest.mark.asyncio
async def test_get_system_config(client: AsyncClient):
    """Test fetching current configuration."""
    response = await client.get("/system/config")
    assert response.status_code == 200
    data = response.json()
    assert "whisper_model" in data

@pytest.mark.asyncio
async def test_update_system_config(client: AsyncClient):
    """Test updating system configuration."""
    new_config = {"whisper_model": "base"}
    response = await client.post("/system/config", json=new_config)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # Verify update persisted
    get_res = await client.get("/system/config")
    assert get_res.json()["whisper_model"] == "base"

@pytest.mark.asyncio
async def test_list_transcripts(client: AsyncClient, db_session):
    """Test listing all transcripts."""
    # Create mock media and transcript
    media = MediaFile(
        filename="list_test.mp3",
        original_filename="list_test.mp3",
        file_path="list_test.mp3",
        media_type="audio/mpeg",
        source=MediaSource.UPLOAD,
        title="List Test"
    )
    db_session.add(media)
    await db_session.flush()
    
    transcript = Transcript(
        media_id=media.id,
        status=TranscriptionStatus.COMPLETED,
        full_text="Some text"
    )
    db_session.add(transcript)
    await db_session.commit()
    
    response = await client.get("/transcripts/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(t["media_title"] == "List Test" for t in data)

@pytest.mark.asyncio
async def test_get_transcript_not_found(client: AsyncClient):
    """Test 404 for non-existent transcript."""
    response = await client.get("/transcripts/9999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_transcript_status_not_found(client: AsyncClient):
    """Test 404 for non-existent transcript status."""
    response = await client.get("/transcripts/9999/status")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_cancel_transcript_not_found(client: AsyncClient):
    """Test 404 for canceling non-existent transcript."""
    response = await client.post("/transcripts/9999/cancel")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_cancel_non_cancellable_transcript(client: AsyncClient, db_session):
    """Test that completed transcripts cannot be canceled."""
    media = MediaFile(
        filename="cancel_fail.mp3",
        original_filename="cancel_fail.mp3",
        file_path="cancel_fail.mp3",
        media_type="audio/mpeg",
        source=MediaSource.UPLOAD
    )
    db_session.add(media)
    await db_session.flush()
    
    transcript = Transcript(
        media_id=media.id,
        status=TranscriptionStatus.COMPLETED
    )
    db_session.add(transcript)
    await db_session.commit()
    
    response = await client.post(f"/transcripts/{transcript.id}/cancel")
    assert response.status_code == 409
    assert "cannot cancel" in response.json()["detail"].lower()
