from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any

from services.system_service import system_service
from engine.transcription_manager import TranscriptionManager
from utils.exceptions import ProcessingError

router = APIRouter()

class ConfigUpdate(BaseModel):
    whisper_model: str

@router.get("/specs")
async def get_system_specs():
    """Get system hardware specifications."""
    return system_service.get_hardware_info()

@router.get("/config")
async def get_config():
    """Get current configuration."""
    return system_service.get_settings()

@router.post("/config")
async def update_config(config: ConfigUpdate):
    """
    Update configuration and hot-swap model.
    """
    try:
        # Save to disk
        system_service.save_settings(config.model_dump())
        
        # Trigger model reload if model changed
        manager = TranscriptionManager.get_instance()
        manager.reload_model(config.whisper_model)
        
        return {"status": "success", "message": f"Model updated to {config.whisper_model}"}
        
    except Exception as e:
        raise ProcessingError(str(e))
