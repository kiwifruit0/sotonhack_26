from motor.motor_asyncio import AsyncIOMotorClient

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
