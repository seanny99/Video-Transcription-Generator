import pytest
import json
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

from services.system_service import SystemService
from engine.transcription_manager import TranscriptionManager
from config import settings

# --- SystemService Tests ---

@pytest.fixture
def clean_system_service(tmp_path):
    """Fixture to provide a SystemService with a temp settings file."""
    # Monkeypatch the SETTINGS_FILE to point to a temp file
    temp_settings = tmp_path / "test_settings.json"
    with patch("services.system_service.SystemService.SETTINGS_FILE", temp_settings):
        service = SystemService()
        yield service, temp_settings

def test_missing_settings_file_creates_default(clean_system_service):
    service, path = clean_system_service
    # File should create on init
    assert path.exists()
    data = json.loads(path.read_text())
    assert "whisper_model" in data

def test_corrupt_settings_file_handling(clean_system_service):
    """Test resilience against broken JSON."""
    service, path = clean_system_service
    # Write garbage
    path.write_text("{ garbage json }")
    
    # helper to reset internal cache if any (singleton pattern makes this tricky, but our init handles it)
    # Re-init service to simulate app restart
    with patch("services.system_service.SystemService.SETTINGS_FILE", path):
        service = SystemService()
        # Should not crash, should return defaults/fallback
        result = service.get_settings()
        assert "whisper_model" in result  # fallback to memory defaults

def test_concurrent_setting_updates(clean_system_service):
    service, path = clean_system_service
    # Rapid updates
    for i in range(5):
        service.save_settings({"whisper_model": f"model_{i}"})
    
    final = service.get_settings()
    assert final["whisper_model"] == "model_4"

# --- TranscriptionManager Tests ---

@pytest.mark.asyncio
async def test_hot_swap_same_model_is_noop():
    manager = TranscriptionManager.get_instance()
    # Mock _load_model to verify it's NOT called
    with patch.object(manager, '_load_model') as mock_load:
        original_model = settings.whisper_model
        
        # Set internal state
        manager._model_name = original_model
        manager._model = MagicMock() # Simulate loaded model
        
        # Action: Reload same model
        manager.reload_model(original_model)
        
        # Assert: No load triggered
        mock_load.assert_not_called()

@pytest.mark.asyncio
async def test_hot_swap_new_model_triggers_load():
    manager = TranscriptionManager.get_instance()
    with patch.object(manager, '_load_model') as mock_load:
        manager._model_name = "old_model"
        manager._model = MagicMock()
        
        # Action: Reload NEW model
        manager.reload_model("new_model")
        
        # Assert: Loaded triggered
        assert manager._model is None # Unloaded
        assert manager._model_name == "new_model"
        mock_load.assert_called_once()
