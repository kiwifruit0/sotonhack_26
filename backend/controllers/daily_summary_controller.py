from pydub import AudioSegment
from .speech_controller import output_speech
from ..routers.db_router import list_users
import asyncio

short_pause = AudioSegment.silent(duration=500)   
long_pause = AudioSegment.silent(duration=1500)

async def collate_summaries(user):
    friends = None
    summaries = {}
    combined_audio = AudioSegment.empty()
    

    for name, audio in summaries.items():
        try:
            intro_file_path = output_speech(None, f"{name} says")
            intro_seg = AudioSegment.from_file(intro_file_path)
            summary_seg = AudioSegment.from_file(audio)
            combined_audio += intro_seg + short_pause + summary_seg + long_pause
        except Exception as e:
                print(f"Error processing {name}: {e}")
                continue
    output_path = "final_briefing.mp3"
    combined_audio.export(output_path, format="mp3")
    
    return output_path


