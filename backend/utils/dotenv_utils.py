# Import the necessary module
import os

from dotenv import load_dotenv

    
load_dotenv()

def get_elevenlabs_key():
    return os.getenv("ELEVENLABS_KEY")