# Import the necessary module
import os

from dotenv import load_dotenv




def get_elevenlabs_key():
    load_dotenv()
    ELEVENLABS_KEY = os.getenv("ELEVENLABS_KEY")