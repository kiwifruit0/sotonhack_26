import io

from pydub import AudioSegment

from ..routers.db_router import (
    _get_user_by_username,
    fetch_daily_summary,
    get_audio_segment_from_audio_path,
)
from ..utils.database import forum_answers, forum_posts, users
from .speech_controller import output_speech

short_pause = AudioSegment.silent(duration=500)
long_pause = AudioSegment.silent(duration=1250)


async def collate_summaries(username):
    result = await fetch_daily_summary(username)
    summaries = result["friendSummaries"]
    combined_audio = AudioSegment.empty()

    if not summaries:
        intro_generator = await output_speech(
            username, "There are no summaries from your friends to read."
        )
        intro_bytes = b"".join(intro_generator)
        combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

    else:
        intro_generator = await output_speech(
            username, "Here's what your friends are up to"
        )
        intro_bytes = b"".join(intro_generator)
        combined_audio += AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")

    for entry in summaries:
        print(entry)
        name = entry["friend"]["username"]
        note = entry["dailyNotes"]
        if not note:
            print("No daily note found for", name)
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


async def collate_forum_answers(username: str, prefer_with_comments: bool = True):
    requesting_user = await _get_user_by_username(username, "username")
    requesting_user_id = requesting_user["_id"]

    user_posts = [
        post
        async for post in forum_posts.find({"authorId": requesting_user_id}).sort(
            "createdAt", -1
        )
    ]
    if not user_posts:
        intro_generator = await output_speech(
            username, "You have not posted a forum question yet."
        )
        intro_bytes = b"".join(intro_generator)
        combined_audio = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
        buf = io.BytesIO()
        combined_audio.export(buf, format="ogg", codec="libopus")
        buf.seek(0)
        return buf

    target_post = user_posts[0]
    if prefer_with_comments:
        for post in user_posts:
            has_answers = await forum_answers.find_one({"postId": post["_id"]}, {"_id": 1})
            if has_answers is not None:
                target_post = post
                break

    post_answers = [
        answer
        async for answer in forum_answers.find({"postId": target_post["_id"]}).sort(
            "createdAt", 1
        )
    ]
    if not post_answers:
        intro_generator = await output_speech(
            username, "No one has answered your most recent forum post yet."
        )
        intro_bytes = b"".join(intro_generator)
        combined_audio = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
        buf = io.BytesIO()
        combined_audio.export(buf, format="ogg", codec="libopus")
        buf.seek(0)
        return buf

    intro_generator = await output_speech(
        username, "Here are the latest replies to your forum post."
    )
    intro_bytes = b"".join(intro_generator)
    combined_audio = AudioSegment.from_file(io.BytesIO(intro_bytes), format="ogg")
    combined_audio += long_pause

    for answer in post_answers:
        transcript_text = str(answer.get("transcriptText", "")).strip()
        if not transcript_text:
            continue

        answer_author = await users.find_one({"_id": answer["authorId"]})
        speaker_username = (
            answer_author["username"]
            if answer_author and isinstance(answer_author.get("username"), str)
            else username
        )
        speaker_name = (
            answer_author["username"]
            if answer_author and isinstance(answer_author.get("username"), str)
            else "Someone"
        )

        try:
            response_generator = await output_speech(
                speaker_username, f"{speaker_name} said {transcript_text}"
            )
            response_bytes = b"".join(response_generator)
            response_segment = AudioSegment.from_file(
                io.BytesIO(response_bytes), format="ogg"
            )
            combined_audio += response_segment + long_pause
        except Exception as e:
            print(f"Error processing forum answer audio for {speaker_name}: {e}")
            continue

    buf = io.BytesIO()
    combined_audio.export(buf, format="ogg", codec="libopus")
    buf.seek(0)
    return buf
