import io

from pydub import AudioSegment
from .speech_controller import output_speech
from ..routers.db_router import fetch_daily_summary, get_audio_segment_from_audio_path, list_forum_posts, list_forum_answers


short_pause = AudioSegment.silent(duration=500)
long_pause = AudioSegment.silent(duration=1250)


async def collate_summaries(username):
    result = await fetch_daily_summary(username)
    summaries = result["friendSummaries"]
    combined_audio = AudioSegment.empty()

    if summaries == []:
        intro_generator = await output_speech(username, "There are no summaries from your friends to read.")
        intro_bytes = b"".join(intro_generator)
        combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

    else:
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

async def collate_forum_answers(username):
    posts = await list_forum_posts(username)
    recent_post = posts.sort("createdAt", -1)[0]


    post_answers = list_forum_answers(recent_post["postId"])
    if post_answers == {}:
        intro_generator = await output_speech(username, f"No one has answered your post yet.")
        intro_bytes = b"".join(intro_generator)
        intro_seg = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
        combined_audio += intro_seg
        
    for answer in post_answers:
        print(answer)

        if not answer:
            print("No answers found for your post", username)
            continue

        try:
            intro_generator = await output_speech(username, f"{username} said {answer["transcriptText"]}")

            intro_bytes = b"".join(intro_generator)
            intro_seg = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
            

            combined_audio += intro_seg + long_pause
            print("note added")
        except Exception as e:
            print(f"Error processing {username}: {e}")
            continue
    buf = io.BytesIO()
    combined_audio.export(buf, format="ogg", codec="libopus")
    buf.seek(0)
    return buf