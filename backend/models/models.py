from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class User(BaseModel):
    username: str
    email: str
    avatarUrl: Optional[str]
    interestIds: List[str] = []
    voiceId: Optional[str]
    createdAt: datetime


class ForumPost(BaseModel):
    authorId: str
    interestIds: List[str]
    questionText: str
    createdAt: datetime


class ForumAnswer(BaseModel):
    postId: str
    authorId: str
    audioUrl: str
    transcriptText: str
    transcriptMeta: dict
    createdAt: datetime


class DailyNote(BaseModel):
    userId: str
    date: str
    audioUrl: str
    durationSec: int
    createdAt: datetime
