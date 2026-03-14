# File: backend/routers/dotenv_router.py
from fastapi import APIRouter, HTTPException
from elevenlabs.client import ElevenLabs
from backend.utils.dotenv_utils import get_elevenlabs_key, get_agent_id
import logging

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

@router.get("/elevenlabs")
def get_elevenlabs():
    try:
        api_key = get_elevenlabs_key()
        agent_id = get_agent_id()

        # Failsafe checks for ElevenLabs credentials
        if not api_key:
            logger.error("ELEVENLABS_API_KEY is missing from .env")
            raise ValueError("ElevenLabs API Key missing")
        if not agent_id:
            logger.error("AGENT_ID is missing from .env")
            raise ValueError("ElevenLabs Agent ID missing")

        # Initialize ElevenLabs client
        client = ElevenLabs(api_key=api_key)

        # Generate the secure signed URL for the frontend SDK
        response = client.conversational_ai.conversations.get_signed_url(
            agent_id=agent_id
        )
        
        return {"signedUrl": response.signed_url}
        
    except Exception as e:
        logger.error(f"ElevenLabs Session Error: {str(e)}")
        # Pass the error back to React to help with debugging connection issues
        raise HTTPException(status_code=500, detail=str(e))