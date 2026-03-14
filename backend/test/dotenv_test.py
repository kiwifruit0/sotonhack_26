# Import the necessary module
import os

from dotenv import load_dotenv


def print_dotenv():
    # Load environment variables from the .env file (if present)
    load_dotenv()

    # Access environment variables as if they came from the actual environment
    GEMINI_KEY = os.getenv("GEMINI_KEY")

    # Example usage
    print(f"KEY: {GEMINI_KEY}")
