from ..utils.dotenv_utils import get_elevenlabs_key
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

from fastapi import HTTPException
from google import genai

elevenlabs = ElevenLabs(
  api_key=get_elevenlabs_key()
)
client = genai.Client()
MODEL_ID = "gemini-2.5-flash-lite"

def output_text(user_id, text_contents):
    audio = elevenlabs.text_to_speech.convert(
        text=text_contents,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    return audio


# def input_speech():

#     transcription = elevenlabs.speech_to_text.convert(
#         file=""
#         model_id="scribe_v2", # Model to use
#         tag_audio_events=True, # Tag audio events like laughter, applause, etc.
#         language_code="eng", # Language of the audio file. If set to None, the model will detect the language automatically.
#         diarize=False, # Whether to annotate who is speaking
#     )

#     return transcription


async def call_gemini(prompt):
    """Helper to handle the API call and basic error checking."""
    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Provider Error: {str(e)}")