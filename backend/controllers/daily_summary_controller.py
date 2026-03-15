import io

from pydub import AudioSegment
from .speech_controller import output_speech
from ..routers.db_router import fetch_daily_summary, get_audio_segment_from_audio_path


short_pause = AudioSegment.silent(duration=500)
long_pause = AudioSegment.silent(duration=1250)


async def collate_summaries(username):
    result = await fetch_daily_summary(username)
    summaries = result["friendSummaries"]
    combined_audio = AudioSegment.empty()

    intro_generator = await output_speech(username, "Here's what your friends are up to")
    intro_bytes = b"".join(intro_generator)
    combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

    for entry in summaries:
        print(entry)
        name = entry["friend"]["username"]
        note = entry["dailyNotes"]
        if not note:
            print("No daily note found for" , name)
            continue
        
        try:
            intro_generator = await output_speech(username, f"{name} says")
                        
                        
            intro_bytes = b"".join(intro_generator)
            intro_seg = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
            summary = await get_audio_segment_from_audio_path(note[0]["audioPath"])


            combined_audio += intro_seg + short_pause + summary + long_pause
            print("note added")
        except Exception as e:
            print(f"Error processing {name}: {e}")
            continue

    buf = io.BytesIO()
    combined_audio.export(buf, format="ogg", codec="libopus")
    buf.seek(0)
    return buf
