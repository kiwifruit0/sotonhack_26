from __future__ import annotations
from backend.utils.supabase_storage import (
    SupabaseStorageError,
    create_storage_signed_url,
    upload_storage_object,
)
from backend.utils.dotenv_utils import (
    get_supabase_service_role_key,
    get_supabase_storage_bucket,
    get_supabase_url,
)
from backend.utils.database import daily_notes, users

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def _require_supabase_config() -> tuple[str, str, str]:
    supabase_url = get_supabase_url()
    service_role_key = get_supabase_service_role_key()
    bucket_name = get_supabase_storage_bucket()

    if not supabase_url:
        raise ValueError("SUPABASE_URL is missing in backend/.env")
    if not service_role_key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is missing in backend/.env")
    if not bucket_name:
        raise ValueError("SUPABASE_STORAGE_BUCKET is missing in backend/.env")

    return supabase_url.rstrip("/"), service_role_key, bucket_name


async def test_mongodb_read_write() -> None:
    run_id = uuid4().hex
    user_payload = {
        "username": f"dbtest-{run_id[:8]}",
        "email": f"dbtest-{run_id[:8]}@example.com",
        "avatarUrl": None,
        "interestIds": [],
        "voiceId": f"voice-{run_id[:12]}",
        "createdAt": datetime.now(timezone.utc),
        "testRunId": run_id,
    }

    created_user_id = None
    created_daily_note_id = None

    try:
        user_insert = await users.insert_one(user_payload)
        created_user_id = user_insert.inserted_id

        fetched_user = await users.find_one({"_id": created_user_id})
        assert fetched_user is not None, "Mongo read failed: inserted user not found"
        assert fetched_user.get("voiceId") == user_payload["voiceId"], (
            "Mongo read failed: user voiceId mismatch"
        )

        daily_note_payload = {
            "userId": created_user_id,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "audioUrl": f"https://example.com/test/{run_id}.webm",
            "durationSec": 30,
            "createdAt": datetime.now(timezone.utc),
            "testRunId": run_id,
        }
        daily_note_insert = await daily_notes.insert_one(daily_note_payload)
        created_daily_note_id = daily_note_insert.inserted_id

        fetched_daily_note = await daily_notes.find_one({"_id": created_daily_note_id})
        assert fetched_daily_note is not None, (
            "Mongo read failed: inserted daily note not found"
        )
        assert fetched_daily_note.get("userId") == created_user_id, (
            "Mongo read failed: daily note userId mismatch"
        )
    finally:
        if created_daily_note_id is not None:
            await daily_notes.delete_one({"_id": created_daily_note_id})
        if created_user_id is not None:
            await users.delete_one({"_id": created_user_id})


async def _delete_supabase_object(storage_path: str) -> None:
    supabase_url, service_role_key, bucket_name = _require_supabase_config()
    delete_url = f"{supabase_url}/storage/v1/object/{bucket_name}"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.request(
            "DELETE", delete_url, headers=headers, json={"prefixes": [storage_path]}
        )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase cleanup failed ({response.status_code}): {response.text}"
        )


async def test_supabase_read_write() -> None:
    run_id = uuid4().hex
    storage_path = f"tests/db-testing/{run_id}.webm"
    audio_bytes = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00"

    await upload_storage_object(storage_path, audio_bytes, "audio/webm")
    signed_url = await create_storage_signed_url(storage_path, expires_in=300)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(signed_url)
        if response.status_code >= 400:
            raise RuntimeError(
                f"Supabase read failed ({response.status_code}): {response.text}"
            )
        if response.content != audio_bytes:
            raise AssertionError("Supabase read failed: downloaded bytes mismatch")
    finally:
        await _delete_supabase_object(storage_path)


async def run_db_tests() -> None:
    await test_mongodb_read_write()
    print("PASS: MongoDB read/write methods")

    await test_supabase_read_write()
    print("PASS: Supabase storage read/write methods")

    print("PASS: All DB tests passed.")


if __name__ == "__main__":
    try:
        asyncio.run(run_db_tests())
    except (
        AssertionError,
        SupabaseStorageError,
        ValueError,
        RuntimeError,
        httpx.HTTPError,
    ) as exc:
        print(f"FAIL: {exc}")
        raise SystemExit(1) from exc
