import json
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any
from uuid import uuid4

import httpx
from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.encoders import jsonable_encoder
from pydub import AudioSegment
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

from ..models.models import (
    DailyNote,
    ForumAnswer,
    ForumPost,
    FriendshipRequest,
    User,
    UserInterestAddRequest,
    UserVoiceIdUpdateRequest,
)
from ..utils.database import (
    daily_notes,
    forum_answers,
    forum_posts,
    friendships,
    interests,
    users,
)
from ..utils.supabase_storage import (
    SupabaseStorageError,
    create_storage_signed_url,
    upload_storage_object,
)

router = APIRouter()

DEFAULT_INTEREST_NAMES = [
    "Arts & Design",
    "Digital Culture",
    "Content Creation",
    "Crafting & DIY",
    "Photography & Film",
    "Competitive Gaming",
    "Casual Gaming",
    "Tabletop & Roleplaying",
    "Live Music & Festivals",
    "Performing Arts",
    "Outdoor Adventure",
    "Team Sports",
    "Individual Athletics",
    "Fitness & Wellness",
    "Combat Sports",
    "Home Cooking",
    "Fine Dining & Gastronomy",
    "Coffee & Tea Culture",
    "Mixology & Nightlife",
    "Baking & Pastry",
    "Personal Finance",
    "Tech & Innovation",
    "Science & Nature",
    "History & Humanities",
    "Self-Improvement",
    "Spirituality & Mindfulness",
    "Social Activism",
    "Volunteering & Charity",
    "Language & Linguistics",
    "Global Travel",
    "Local Exploration",
    "Home & Interior Styling",
    "Gardening & Plant Care",
    "Pet Ownership",
    "Fashion & Personal Style",
    "Automotive & Mechanics",
    "Parenting & Family Life",
    "Career & Entrepreneurship",
    "Sustainable Living",
    "Political Discourse",
]


def _parse_object_id(value: str, field_name: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return ObjectId(value)


def _serialize_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    return value


def _serialize_document(document: dict[str, Any] | None) -> dict[str, Any]:
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    serialized = {key: _serialize_value(value) for key, value in document.items()}
    serialized["id"] = serialized.pop("_id")
    return jsonable_encoder(serialized)


def _audio_extension(audio_file: UploadFile) -> str:
    if audio_file.filename and "." in audio_file.filename:
        extension = audio_file.filename.rsplit(".", 1)[1].lower()
        return f".{extension[:10]}"

    extension_map = {
        "audio/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/ogg": ".ogg",
    }
    return extension_map.get(audio_file.content_type or "", ".bin")


async def _read_audio_file(audio_file: UploadFile) -> tuple[str, bytes]:
    content_type = audio_file.content_type or "application/octet-stream"
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be audio/*")

    file_bytes = await audio_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    return content_type, file_bytes


async def _get_user_by_username(username: str, field_name: str) -> dict[str, Any]:
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")

    user = await users.find_one({"username": normalized_username})
    if user is None:
        raise HTTPException(status_code=404, detail=f"{field_name} user not found")

    return user


def _friend_pair_key(first_id: ObjectId, second_id: ObjectId) -> str:
    return ":".join(sorted([str(first_id), str(second_id)]))


def _previous_utc_day_window(reference_time: datetime) -> tuple[datetime, datetime]:
    today_start = reference_time.replace(hour=0, minute=0, second=0, microsecond=0)
    return today_start - timedelta(days=1), today_start


async def _get_accepted_friend_ids(user_id: ObjectId) -> list[ObjectId]:
    friend_ids: set[ObjectId] = set()
    async for friendship in friendships.find(
        {
            "status": "accepted",
            "$or": [
                {"requestingFriendId": user_id},
                {"incomingFriendId": user_id},
            ],
        }
    ):
        requesting_friend_id = friendship["requestingFriendId"]
        incoming_friend_id = friendship["incomingFriendId"]
        friend_ids.add(
            incoming_friend_id
            if requesting_friend_id == user_id
            else requesting_friend_id
        )
    return list(friend_ids)


def _normalize_interest_names(interest_names: list[str]) -> list[str]:
    normalized_names: list[str] = []
    for interest_name in interest_names:
        normalized_name = interest_name.strip()
        if not normalized_name:
            raise HTTPException(
                status_code=400,
                detail="interestNames cannot contain empty values",
            )
        if normalized_name not in normalized_names:
            normalized_names.append(normalized_name)

    if not normalized_names:
        raise HTTPException(
            status_code=400,
            detail="interestNames must contain at least one value",
        )

    return normalized_names


@router.post("/users")
async def create_user(user: User):
    payload = user.model_dump()
    payload["username"] = user.username.strip()
    if not payload["username"]:
        raise HTTPException(status_code=400, detail="username cannot be empty")
    payload["interestIds"] = [
        _parse_object_id(interest_id, "interestId") for interest_id in user.interestIds
    ]
    try:
        result = await users.insert_one(payload)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="username already exists") from exc
    created_user = await users.find_one({"_id": result.inserted_id})
    return _serialize_document(created_user)


@router.get("/users")
async def list_users():
    return [_serialize_document(user) async for user in users.find({})]


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    object_id = _parse_object_id(user_id, "user_id")
    user = await users.find_one({"_id": object_id})
    return _serialize_document(user)


@router.patch("/users/{username}/voice-id")
async def update_user_voice_id(username: str, request: UserVoiceIdUpdateRequest):
    user = await _get_user_by_username(username, "username")
    voice_id = request.voiceId

    if voice_id is not None:
        voice_id = voice_id.strip()
        if not voice_id:
            raise HTTPException(status_code=400, detail="voiceId cannot be empty")

    await users.update_one({"_id": user["_id"]}, {"$set": {"voiceId": voice_id}})
    updated_user = await users.find_one({"_id": user["_id"]})
    return _serialize_document(updated_user)


@router.post("/users/{username}/interests")
async def add_user_interests(username: str, request: UserInterestAddRequest):
    user = await _get_user_by_username(username, "username")
    normalized_interest_names = _normalize_interest_names(request.interestNames)

    interest_documents = [
        interest
        async for interest in interests.find(
            {"name": {"$in": normalized_interest_names}}
        )
    ]
    found_names = {interest["name"] for interest in interest_documents}
    missing_interests = [
        interest_name
        for interest_name in normalized_interest_names
        if interest_name not in found_names
    ]
    if missing_interests:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Some interests were not found",
                "missingInterests": missing_interests,
            },
        )

    interest_ids = [interest["_id"] for interest in interest_documents]
    await users.update_one(
        {"_id": user["_id"]},
        {"$addToSet": {"interestIds": {"$each": interest_ids}}},
    )
    updated_user = await users.find_one({"_id": user["_id"]})
    return _serialize_document(updated_user)


@router.post("/interests/seed-defaults")
async def seed_default_interests():
    created_at = datetime.now(timezone.utc)
    operations = [
        UpdateOne(
            {"name": interest_name},
            {"$setOnInsert": {"name": interest_name, "createdAt": created_at}},
            upsert=True,
        )
        for interest_name in DEFAULT_INTEREST_NAMES
    ]
    result = await interests.bulk_write(operations, ordered=False)
    return {
        "totalDefaultInterests": len(DEFAULT_INTEREST_NAMES),
        "inserted": result.upserted_count,
        "alreadyPresent": len(DEFAULT_INTEREST_NAMES) - result.upserted_count,
    }


@router.get("/interests")
async def list_interests():
    return [
        _serialize_document(interest)
        async for interest in interests.find({}).sort("name", 1)
    ]


@router.post("/friendships/request")
async def send_friend_request(friend_request: FriendshipRequest):
    requesting_user = await _get_user_by_username(
        friend_request.requestingUsername, "requestingUsername"
    )
    incoming_user = await _get_user_by_username(
        friend_request.incomingUsername, "incomingUsername"
    )

    requesting_user_id = requesting_user["_id"]
    incoming_user_id = incoming_user["_id"]
    if requesting_user_id == incoming_user_id:
        raise HTTPException(status_code=400, detail="Users cannot friend themselves")

    pair_key = _friend_pair_key(requesting_user_id, incoming_user_id)
    existing_friendship = await friendships.find_one({"friendPairKey": pair_key})
    if existing_friendship is not None:
        if existing_friendship.get("status") == "accepted":
            raise HTTPException(status_code=409, detail="Users are already friends")
        if existing_friendship.get("requestingFriendId") == requesting_user_id:
            raise HTTPException(
                status_code=409, detail="Friend request already pending"
            )
        raise HTTPException(
            status_code=409,
            detail="Incoming friend request already pending; accept or deny it",
        )

    payload = {
        "requestingFriendId": requesting_user_id,
        "incomingFriendId": incoming_user_id,
        "friendPairKey": pair_key,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc),
    }
    try:
        result = await friendships.insert_one(payload)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409, detail="Friend request already exists"
        ) from exc
    created_friendship = await friendships.find_one({"_id": result.inserted_id})
    return _serialize_document(created_friendship)


@router.post("/friendships/accept")
async def accept_friend_request(friend_request: FriendshipRequest):
    requesting_user = await _get_user_by_username(
        friend_request.requestingUsername, "requestingUsername"
    )
    incoming_user = await _get_user_by_username(
        friend_request.incomingUsername, "incomingUsername"
    )

    requesting_user_id = requesting_user["_id"]
    incoming_user_id = incoming_user["_id"]
    if requesting_user_id == incoming_user_id:
        raise HTTPException(status_code=400, detail="Users cannot friend themselves")

    friendship = await friendships.find_one(
        {
            "requestingFriendId": requesting_user_id,
            "incomingFriendId": incoming_user_id,
            "status": "pending",
        }
    )
    if friendship is None:
        raise HTTPException(status_code=404, detail="Pending friend request not found")

    await friendships.update_one(
        {"_id": friendship["_id"]},
        {"$set": {"status": "accepted", "updatedAt": datetime.now(timezone.utc)}},
    )
    updated_friendship = await friendships.find_one({"_id": friendship["_id"]})
    return _serialize_document(updated_friendship)


@router.post("/friendships/deny")
async def deny_friend_request(friend_request: FriendshipRequest):
    requesting_user = await _get_user_by_username(
        friend_request.requestingUsername, "requestingUsername"
    )
    incoming_user = await _get_user_by_username(
        friend_request.incomingUsername, "incomingUsername"
    )

    requesting_user_id = requesting_user["_id"]
    incoming_user_id = incoming_user["_id"]
    if requesting_user_id == incoming_user_id:
        raise HTTPException(status_code=400, detail="Users cannot friend themselves")

    friendship = await friendships.find_one(
        {
            "requestingFriendId": requesting_user_id,
            "incomingFriendId": incoming_user_id,
            "status": "pending",
        }
    )
    if friendship is None:
        raise HTTPException(status_code=404, detail="Pending friend request not found")

    await friendships.delete_one({"_id": friendship["_id"]})
    return {"message": "Friend request denied"}


@router.get("/users/{username}/friends")
async def get_user_friends(username: str):
    user = await _get_user_by_username(username, "username")
    friend_ids = await _get_accepted_friend_ids(user["_id"])

    if not friend_ids:
        return []

    return [
        _serialize_document(friend)
        async for friend in users.find({"_id": {"$in": list(friend_ids)}})
    ]


async def fetch_daily_summary(username: str):
    user = await _get_user_by_username(username, "username")
    user_id = user["_id"]
    friend_ids = await _get_accepted_friend_ids(user_id)

    summary_generated_at = datetime.now(timezone.utc)
    await users.update_one(
        {"_id": user_id}, {"$set": {"last_summary_time": summary_generated_at}}
    )

    window_start, window_end = _previous_utc_day_window(summary_generated_at)
    previous_date = window_start.date().isoformat()

    if not friend_ids:
        return {
            "username": username,
            "last_summary_time": summary_generated_at.isoformat(),
            "windowStart": window_start.isoformat(),
            "windowEnd": window_end.isoformat(),
            "friendSummaries": [],
        }

    friend_documents = [
        friend async for friend in users.find({"_id": {"$in": friend_ids}})
    ]
    serialized_friends_by_id = {
        friend["_id"]: _serialize_document(friend) for friend in friend_documents
    }

    notes_by_friend_id: dict[ObjectId, list[dict[str, Any]]] = {
        friend_id: [] for friend_id in friend_ids
    }
    notes_query = {
        "userId": {"$in": friend_ids},
        "$or": [
            {"createdAt": {"$gte": window_start, "$lt": window_end}},
            {"date": previous_date},
        ],
    }
    async for note in daily_notes.find(notes_query):
        notes_by_friend_id[note["userId"]].append(_serialize_document(note))

    friend_summaries = []
    for friend_id in friend_ids:
        friend = serialized_friends_by_id.get(friend_id)
        if friend is None:
            continue
        friend_summaries.append(
            {
                "friend": friend,
                "dailyNotes": notes_by_friend_id.get(friend_id, []),
            }
        )

    return {
        "username": username,
        "last_summary_time": summary_generated_at.isoformat(),
        "windowStart": window_start.isoformat(),
        "windowEnd": window_end.isoformat(),
        "friendSummaries": friend_summaries,
    }


@router.get("/users/{username}/daily-summary")
async def get_daily_summary(username: str):
    return await fetch_daily_summary(username)


@router.post("/daily-notes")
async def create_daily_note(daily_note: DailyNote):
    user_id = _parse_object_id(daily_note.userId, "userId")
    user_exists = await users.find_one({"_id": user_id})
    if user_exists is None:
        raise HTTPException(status_code=404, detail="User not found")

    payload = daily_note.model_dump()
    payload["userId"] = user_id
    result = await daily_notes.insert_one(payload)
    created_daily_note = await daily_notes.find_one({"_id": result.inserted_id})
    return _serialize_document(created_daily_note)


@router.get("/daily-notes")
async def list_daily_notes(user_id: str | None = Query(default=None)):
    query: dict[str, Any] = {}
    if user_id is not None:
        query["userId"] = _parse_object_id(user_id, "user_id")

    return [
        _serialize_document(daily_note) async for daily_note in daily_notes.find(query)
    ]


@router.get("/daily-notes/{daily_note_id}")
async def get_daily_note(daily_note_id: str):
    object_id = _parse_object_id(daily_note_id, "daily_note_id")
    daily_note = await daily_notes.find_one({"_id": object_id})
    return _serialize_document(daily_note)


@router.post("/daily-notes/upload")
async def upload_daily_note_audio(
    user_id: str = Form(...),
    date: str = Form(...),
    duration_sec: int = Form(...),
    audio_file: UploadFile = File(...),
):
    user_object_id = _parse_object_id(user_id, "user_id")
    user = await users.find_one({"_id": user_object_id})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    content_type, file_bytes = await _read_audio_file(audio_file)
    audio_path = f"daily-notes/{user_id}/{uuid4().hex}{_audio_extension(audio_file)}"

    try:
        upload_result = await upload_storage_object(
            audio_path, file_bytes, content_type
        )
    except SupabaseStorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payload = {
        "userId": user_object_id,
        "date": date,
        "audioUrl": upload_result["publicUrl"],
        "audioPath": upload_result["path"],
        "durationSec": duration_sec,
        "mimeType": content_type,
        "sizeBytes": len(file_bytes),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await daily_notes.insert_one(payload)
    created_daily_note = await daily_notes.find_one({"_id": result.inserted_id})
    return _serialize_document(created_daily_note)


@router.post("/forum-posts")
async def create_forum_post(forum_post: ForumPost):
    author_id = _parse_object_id(forum_post.authorId, "authorId")
    user_exists = await users.find_one({"_id": author_id})
    if user_exists is None:
        raise HTTPException(status_code=404, detail="User not found")

    payload = forum_post.model_dump()
    payload["authorId"] = author_id
    payload["interestIds"] = [
        _parse_object_id(interest_id, "interestId")
        for interest_id in forum_post.interestIds
    ]
    result = await forum_posts.insert_one(payload)
    created_forum_post = await forum_posts.find_one({"_id": result.inserted_id})
    return _serialize_document(created_forum_post)


@router.get("/forum-posts")
async def list_forum_posts(author_id: str | None = Query(default=None)):
    query: dict[str, Any] = {}
    if author_id is not None:
        query["authorId"] = _parse_object_id(author_id, "author_id")

    return [_serialize_document(post) async for post in forum_posts.find(query)]


@router.get("/forum-posts/{forum_post_id}")
async def get_forum_post(forum_post_id: str):
    object_id = _parse_object_id(forum_post_id, "forum_post_id")
    forum_post = await forum_posts.find_one({"_id": object_id})
    return _serialize_document(forum_post)


@router.post("/forum-answers")
async def create_forum_answer(forum_answer: ForumAnswer):
    post_id = _parse_object_id(forum_answer.postId, "postId")
    post_exists = await forum_posts.find_one({"_id": post_id})
    if post_exists is None:
        raise HTTPException(status_code=404, detail="Forum post not found")

    author_id = _parse_object_id(forum_answer.authorId, "authorId")
    user_exists = await users.find_one({"_id": author_id})
    if user_exists is None:
        raise HTTPException(status_code=404, detail="User not found")

    payload = forum_answer.model_dump()
    payload["postId"] = post_id
    payload["authorId"] = author_id
    result = await forum_answers.insert_one(payload)
    created_forum_answer = await forum_answers.find_one({"_id": result.inserted_id})
    return _serialize_document(created_forum_answer)


@router.get("/forum-posts/matching/{username}")
async def list_matching_forum_posts(username: str):
    print(f'Finding matching forum posts for username: {username}')
    user = await _get_user_by_username(username, "username")
    print(f'user: {user}')
    interest_ids = user.get("interestIds", [])
    if not interest_ids:
        return []

    cursor = forum_posts.find({"interestIds": {"$in": interest_ids}}).sort(
        "createdAt", -1
    )
    print(cursor)

    return [_serialize_document(post) async for post in cursor]


@router.get("/forum-answers")
async def list_forum_answers(post_id: str | None = Query(default=None)):
    query: dict[str, Any] = {}
    if post_id is not None:
        query["postId"] = _parse_object_id(post_id, "post_id")

    return [_serialize_document(answer) async for answer in forum_answers.find(query)]


@router.get("/forum-answers/{forum_answer_id}")
async def get_forum_answer(forum_answer_id: str):
    object_id = _parse_object_id(forum_answer_id, "forum_answer_id")
    forum_answer = await forum_answers.find_one({"_id": object_id})
    return _serialize_document(forum_answer)


@router.post("/forum-answers/upload")
async def upload_forum_answer_audio(
    post_id: str = Form(...),
    author_id: str = Form(...),
    transcript_text: str = Form(...),
    transcript_meta: str | None = Form(default=None),
    audio_file: UploadFile = File(...),
):
    post_object_id = _parse_object_id(post_id, "post_id")
    post = await forum_posts.find_one({"_id": post_object_id})
    if post is None:
        raise HTTPException(status_code=404, detail="Forum post not found")

    author_object_id = _parse_object_id(author_id, "author_id")
    author = await users.find_one({"_id": author_object_id})
    if author is None:
        raise HTTPException(status_code=404, detail="User not found")

    metadata: dict[str, Any] = {}
    if transcript_meta:
        try:
            parsed_metadata = json.loads(transcript_meta)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail="transcript_meta must be JSON"
            ) from exc
        if not isinstance(parsed_metadata, dict):
            raise HTTPException(
                status_code=400, detail="transcript_meta must be a JSON object"
            )
        metadata = parsed_metadata

    content_type, file_bytes = await _read_audio_file(audio_file)
    audio_path = f"forum-answers/{post_id}/{uuid4().hex}{_audio_extension(audio_file)}"

    try:
        upload_result = await upload_storage_object(
            audio_path, file_bytes, content_type
        )
    except SupabaseStorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payload = {
        "postId": post_object_id,
        "authorId": author_object_id,
        "audioUrl": upload_result["publicUrl"],
        "audioPath": upload_result["path"],
        "transcriptText": transcript_text,
        "transcriptMeta": metadata,
        "mimeType": content_type,
        "sizeBytes": len(file_bytes),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await forum_answers.insert_one(payload)
    created_answer = await forum_answers.find_one({"_id": result.inserted_id})
    return _serialize_document(created_answer)


@router.get("/storage/signed-url")
async def get_audio_signed_url(
    path: str = Query(..., min_length=1),
    expires_in: int = Query(default=3600, ge=60, le=604800),
):
    try:
        signed_url = await create_storage_signed_url(path, expires_in)
    except SupabaseStorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"path": path, "signedUrl": signed_url, "expiresIn": expires_in}


def _audio_format_from_path(audio_path: str) -> str | None:
    if "." not in audio_path:
        return None

    extension = audio_path.rsplit(".", 1)[1].lower()
    if extension in {"ogg", "oga"}:
        return "ogg"
    if extension in {"webm", "wav", "mp3"}:
        return extension
    if extension in {"m4a"}:
        return "mp4"
    return None


async def get_audio_segment_from_audio_path(
    audio_path: str, expires_in: int = 3600
) -> AudioSegment:
    signed_url_payload = await get_audio_signed_url(
        path=audio_path, expires_in=expires_in
    )
    signed_url = signed_url_payload["signedUrl"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(signed_url)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Signed URL audio download failed ({response.status_code}): {
                response.text
            }",
        )
    if not response.content:
        raise HTTPException(status_code=502, detail="Signed URL returned empty audio")

    format_hint = _audio_format_from_path(audio_path)
    try:
        return AudioSegment.from_file(BytesIO(response.content), format=format_hint)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to decode audio from storage path {audio_path}: {exc}",
        ) from exc


@router.get("/friendships/pending")
async def get_pending_incoming_requests(incomingUsername: str = Query(...)):
    incoming_user = await _get_user_by_username(incomingUsername, "incomingUsername")
    incoming_user_id = incoming_user["_id"]

    pending = []
    async for friendship in friendships.find(
        {
            "incomingFriendId": incoming_user_id,
            "status": "pending",
        }
    ):
        # Resolve the requesting user's username so the frontend doesn't need a second fetch
        requesting_user = await users.find_one(
            {"_id": friendship["requestingFriendId"]}
        )
        requesting_username = (
            requesting_user["username"]
            if requesting_user
            else str(friendship["requestingFriendId"])
        )

        doc = _serialize_document(friendship)
        doc["requestingUsername"] = requesting_username
        doc["incomingUsername"] = incomingUsername
        pending.append(doc)

    return pending
