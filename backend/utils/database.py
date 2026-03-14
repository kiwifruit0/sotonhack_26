import certifi
import os
from motor.motor_asyncio import AsyncIOMotorClient

os.environ["SSL_CERT_FILE"] = certifi.where()
from .dotenv_utils import get_mongo_uri

MONGO_URI = get_mongo_uri()
if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not set. Add it to backend/.env")

client = AsyncIOMotorClient(MONGO_URI)

db = client["sotonhack"]

users = db.users
interests = db.interests
friendships = db.friendships
daily_notes = db.daily_notes
forum_posts = db.forum_posts
forum_answers = db.forum_answers


async def ensure_database_indexes() -> None:
    await users.create_index("username", unique=True)
    await friendships.create_index("friendPairKey", unique=True)
    await friendships.create_index([("incomingFriendId", 1), ("status", 1)])
    await friendships.create_index([("requestingFriendId", 1), ("status", 1)])
