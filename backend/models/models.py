from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class User(BaseModel):
    username: str
    avatarUrl: Optional[str]
    interestIds: List[str] = []
    voiceId: Optional[str]
    last_summary_time: Optional[datetime] = None
    createdAt: datetime


class ForumPost(BaseModel):
    authorId: str
    interestIds: List[str]
    questionText: str
    createdAt: datetime


class ForumAnswer(BaseModel):
    postId: str
    authorId: str
    transcriptText: str
    transcriptMeta: dict
    createdAt: datetime


class DailyNote(BaseModel):
    userId: str
    date: str
    audioUrl: str
    durationSec: int
    createdAt: datetime


FriendshipStatus = Literal["accepted", "pending"]


class FriendshipRequest(BaseModel):
    requestingUsername: str
    incomingUsername: str


class UserInterestAddRequest(BaseModel):
    interestNames: List[str]


class UserVoiceIdUpdateRequest(BaseModel):
    voiceId: Optional[str] = None
