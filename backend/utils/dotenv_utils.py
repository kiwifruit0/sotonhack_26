import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

load_dotenv()

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def _load_env():
    load_dotenv(dotenv_path=ENV_PATH)


def get_mongo_uri():
    _load_env()
    MONGO_URI = os.getenv("MONGO_URI")
    return MONGO_URI


def get_supabase_url():
    _load_env()
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    return SUPABASE_URL


def get_supabase_service_role_key():
    _load_env()
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return SUPABASE_SERVICE_ROLE_KEY


def get_supabase_storage_bucket():
    _load_env()
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET")
    return SUPABASE_STORAGE_BUCKET


def get_elevenlabs_key():
    return os.getenv("ELEVENLABS_API_KEY")

def get_agent_id():
    # This is the specific ID for the transcription agent
    return os.getenv("AGENT_ID")
