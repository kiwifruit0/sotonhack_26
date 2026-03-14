from pydub import AudioSegment
from .speech_controller import output_speech
import io

short_pause = AudioSegment.silent(duration=500)
long_pause = AudioSegment.silent(duration=1500)

async def collate_summaries(user):
    summaries = {}
    combined_audio = AudioSegment.empty()

    intro_generator = output_speech(None, "Here's what your friends are up to")
    intro_bytes = b"".join(intro_generator)
    combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="mp3")

    for name, audio in summaries.items():
        try:
            intro_generator = output_speech(None, f"{name} says")
            intro_bytes = b"".join(intro_generator)
            intro_seg = AudioSegment.from_file(io.BytesIO(intro_bytes), format="mp3")
            summary_seg = AudioSegment.from_file(io.BytesIO(b"".join(audio)), format="mp3")
            combined_audio += intro_seg + short_pause + summary_seg + long_pause
        except Exception as e:
            print(f"Error processing {name}: {e}")
            continue

    buf = io.BytesIO()
    combined_audio.export(buf, format="mp3")
    buf.seek(0)
    return buf