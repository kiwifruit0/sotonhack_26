# Import the necessary module
import os

from dotenv import load_dotenv


def get_gemini_key():
    load_dotenv()
    GEMINI_KEY = os.getenv("GEMINI_KEY")
    return GEMINI_KEY
