import os
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def _load_env():
    load_dotenv(dotenv_path=ENV_PATH)


def get_gemini_key():
    _load_env()
    GEMINI_KEY = os.getenv("GEMINI_KEY")
    return GEMINI_KEY


def get_mongo_uri():
    _load_env()
    MONGO_URI = os.getenv("MONGO_URI")
    return MONGO_URI
