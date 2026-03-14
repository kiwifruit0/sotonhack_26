from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
TEST_DB_NAME = "audio_social"


def _load_mongo_uri() -> str:
    load_dotenv(dotenv_path=ENV_PATH)
    mongo_uri = os.environ.get("MONGO_URI")
    if not mongo_uri:
        raise ValueError("MONGO_URI is missing in backend/.env")
    return mongo_uri


def create_user(users_collection, run_id: str):
    payload = {
        "username": f"db-test-{run_id[:8]}",
        "email": f"db-test-{run_id[:8]}@example.com",
        "avatarUrl": None,
        "interestIds": [],
        "voiceId": f"voice-{run_id[:12]}",
        "createdAt": datetime.now(timezone.utc),
        "testRunId": run_id,
    }
    result = users_collection.insert_one(payload)
    return result.inserted_id


def read_user(users_collection, user_id):
    return users_collection.find_one({"_id": user_id})


def create_daily_note(daily_notes_collection, user_id, run_id: str):
    payload = {
        "userId": user_id,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "audioUrl": f"https://example.com/test/{run_id}.webm",
        "durationSec": 30,
        "createdAt": datetime.now(timezone.utc),
        "testRunId": run_id,
    }
    result = daily_notes_collection.insert_one(payload)
    return result.inserted_id


def read_daily_notes_for_user(daily_notes_collection, user_id):
    return list(daily_notes_collection.find({"userId": user_id}))


def run_db_read_write_tests():
    mongo_uri = _load_mongo_uri()
    run_id = uuid4().hex

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=15000)
    db = client[TEST_DB_NAME]
    users = db.users
    daily_notes = db.daily_notes

    created_user_id = None
    created_daily_note_id = None

    try:
        client.admin.command("ping")

        created_user_id = create_user(users, run_id)
        fetched_user = read_user(users, created_user_id)
        assert fetched_user is not None, "User write/read failed: user not found"
        assert fetched_user.get("voiceId"), "User write/read failed: voiceId missing"
        assert fetched_user.get("testRunId") == run_id, "User write/read failed: run marker mismatch"

        created_daily_note_id = create_daily_note(daily_notes, created_user_id, run_id)
        fetched_daily_notes = read_daily_notes_for_user(daily_notes, created_user_id)
        assert fetched_daily_notes, "Daily note write/read failed: no notes returned"
        assert any(
            note.get("_id") == created_daily_note_id for note in fetched_daily_notes
        ), "Daily note write/read failed: inserted note not found"

        print("PASS: Database read/write methods are working.")
        print(f"Inserted user: {created_user_id}")
        print(f"Inserted daily note: {created_daily_note_id}")
    finally:
        if created_daily_note_id is not None:
            daily_notes.delete_one({"_id": created_daily_note_id})
        if created_user_id is not None:
            users.delete_one({"_id": created_user_id})
        client.close()


if __name__ == "__main__":
    try:
        run_db_read_write_tests()
    except (AssertionError, ValueError, PyMongoError) as exc:
        print(f"FAIL: {exc}")
        raise SystemExit(1) from exc
