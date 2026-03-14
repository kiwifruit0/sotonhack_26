from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from google import genai
import os
load_dotenv()

elevenlabs = ElevenLabs(
  api_key=os.getenv("ELEVENLABS_KEY"),
)

def output_text(user_id):
    audio = elevenlabs.text_to_speech.convert(
        text="The first move is what sets everything in motion.",
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    return audio


def input_speech():

    transcription = elevenlabs.speech_to_text.convert(
        file=""
        model_id="scribe_v2", # Model to use
        tag_audio_events=True, # Tag audio events like laughter, applause, etc.
        language_code="eng", # Language of the audio file. If set to None, the model will detect the language automatically.
        diarize=False, # Whether to annotate who is speaking
    )

    return transcription

