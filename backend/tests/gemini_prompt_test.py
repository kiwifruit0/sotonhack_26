from ..controllers.speech_controller import call_gemini
import asyncio

from ..utils.dotenv_utils import get_elevenlabs_key
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

elevenlabs = ElevenLabs(
  api_key=get_elevenlabs_key()
)
async def humanize_text(text, ):
    """Rewrites text to sound more conversational and 'human-speakable'."""
    prompt = f"""
    You are an API used inside a web application.
    Rewrite the following text to sound more natural, while keeping the people's exact text. 
    Add connectives between each person's quote.
    Only return ONE prompt. Do not assume genders or extra information

    Input: {text}
    """
    result = await call_gemini(prompt)
    return result

result = asyncio.run(humanize_text("Ryan says: Today i went to the gym and saw my friends in the cinema. Milan says: Today i did revision until the afternoon, then went to the gym and made dinner with my mum."))
print(result)

def output_text(user_id, text_contents):
    audio = elevenlabs.text_to_speech.convert(
        text=text_contents,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    play(audio)


output_text(None, result)