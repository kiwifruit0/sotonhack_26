from pydub import AudioSegment
import requests
from .speech_controller import output_speech
from ..routers.db_router import fetch_daily_summary
import io
import asyncio

short_pause = AudioSegment.silent(duration=500)
long_pause = AudioSegment.silent(duration=1500)
def get_audio_from_url(url, format):
    response = requests.get(url, )
    response.raise_for_status() #
    
    audio_data = io.BytesIO(response.content)
    
    audio = AudioSegment.from_file(audio_data)
    
    return audio

async def collate_summaries(user):
    result = await fetch_daily_summary(user)
    summaries = result["friendSummaries"]
    combined_audio = AudioSegment.empty()

    intro_generator = output_speech(None, "Here's what your friends are up to")
    intro_bytes = b"".join(intro_generator)
    combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

    for entry in summaries:
        name = entry["friend"]["username"]
        notes = entry["dailyNotes"]
        if not notes:
            continue
        notes_text = " ".join(note.get("content", "") for note in notes)
        try:
            intro_generator = output_speech(None, f"{name} says")
            intro_bytes = b"".join(intro_generator)
            intro_seg = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

            summary_generator = output_speech(None, notes_text)
            summary_bytes = b"".join(summary_generator)
            summary_seg = AudioSegment.from_file(io.BytesIO(summary_bytes), format="ogg")

            combined_audio += intro_seg + short_pause + summary_seg + long_pause
        except Exception as e:
            print(f"Error processing {name}: {e}")
            continue

    buf = io.BytesIO()
    combined_audio.export(buf, format="ogg")
    buf.seek(0)
    return buf