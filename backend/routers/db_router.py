import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.encoders import jsonable_encoder
from pymongo.errors import DuplicateKeyError

from ..models.models import DailyNote, ForumAnswer, ForumPost, FriendshipRequest, User
from ..utils.database import daily_notes, forum_answers, forum_posts, friendships, users
from ..utils.supabase_storage import (
    SupabaseStorageError,
    create_storage_signed_url,
    upload_storage_object,
)

router = APIRouter()


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
    user_id = user["_id"]

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

    if not friend_ids:
        return []

    return [
        _serialize_document(friend)
        async for friend in users.find({"_id": {"$in": list(friend_ids)}})
    ]


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
