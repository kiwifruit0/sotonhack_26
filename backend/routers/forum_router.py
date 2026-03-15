from bson import ObjectId
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .db_router import (
    _get_user_by_username,
    _parse_object_id,
    _serialize_document,
    create_forum_post,
    list_interests,
    list_matching_forum_posts,
)
from .speech_router import categorize_text
from ..models.models import ForumPost
from ..utils.database import forum_answers, forum_posts

router = APIRouter()


class ForumTextAnswerRequest(BaseModel):
    transcriptText: str
    transcriptMeta: dict = Field(default_factory=dict)


class ForumAskQuestionRequest(BaseModel):
    transcription: str


@router.get("/get_question/{username}")
async def get_question(username: str):
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail="username cannot be empty")

    user = await _get_user_by_username(normalized_username, "username")

    matching_posts = await list_matching_forum_posts(normalized_username)
    if not matching_posts:
        return {
            "question": None,
            "hasReplied": False,
            "message": "No matching forum posts found",
        }

    for post in matching_posts:
        post_id = post.get("id")
        if not isinstance(post_id, str) or not ObjectId.is_valid(post_id):
            continue

        reply = await forum_answers.find_one(
            {"postId": ObjectId(post_id), "authorId": user["_id"]},
            {"_id": 1},
        )
        if reply is None:
            return {"question": post, "hasReplied": False}

    return {
        "question": None,
        "hasReplied": True,
        "message": "User has replied to all matching forum posts",
    }


@router.post("/answer_question/{username}/{post_id}")
async def answer_question(
    username: str, post_id: str, request: ForumTextAnswerRequest
):
    user = await _get_user_by_username(username, "username")
    post_object_id = _parse_object_id(post_id, "post_id")

    post_exists = await forum_posts.find_one({"_id": post_object_id})
    if post_exists is None:
        raise HTTPException(status_code=404, detail="Forum post not found")

    existing_answer = await forum_answers.find_one(
        {"postId": post_object_id, "authorId": user["_id"]},
        {"_id": 1},
    )
    if existing_answer is not None:
        raise HTTPException(status_code=409, detail="User already answered this post")

    transcript_text = request.transcriptText.strip()
    if not transcript_text:
        raise HTTPException(status_code=400, detail="transcriptText cannot be empty")

    payload = {
        "postId": post_object_id,
        "authorId": user["_id"],
        "transcriptText": transcript_text,
        "transcriptMeta": request.transcriptMeta,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await forum_answers.insert_one(payload)
    created_answer = await forum_answers.find_one({"_id": result.inserted_id})
    return _serialize_document(created_answer)


@router.post("/ask_question/{username}")
async def ask_question(username: str, request: ForumAskQuestionRequest):
    user = await _get_user_by_username(username, "username")
    question_text = request.transcription.strip()
    if not question_text:
        raise HTTPException(status_code=400, detail="transcription cannot be empty")

    category_result = await categorize_text(question_text)
    raw_category_name = category_result.get("processed_text", "")
    if not isinstance(raw_category_name, str):
        raise HTTPException(status_code=502, detail="Failed to categorize question")

    normalized_category_name = (
        raw_category_name.strip().strip('"').strip("'").rstrip(".,!?;:")
    )
    if not normalized_category_name:
        raise HTTPException(status_code=502, detail="Failed to categorize question")

    available_interests = await list_interests()
    selected_interest = next(
        (
            interest
            for interest in available_interests
            if isinstance(interest.get("name"), str)
            and interest["name"].strip().lower() == normalized_category_name.lower()
        ),
        None,
    )
    if selected_interest is None:
        raise HTTPException(
            status_code=404,
            detail=f"Interest category not found: {normalized_category_name}",
        )

    forum_post = ForumPost(
        authorId=str(user["_id"]),
        interestIds=[selected_interest["id"]],
        questionText=question_text,
        createdAt=datetime.now(timezone.utc),
    )
    created_post = await create_forum_post(forum_post)
    return {
        "question": created_post,
        "interestName": selected_interest["name"],
        "interestId": selected_interest["id"],
    }
