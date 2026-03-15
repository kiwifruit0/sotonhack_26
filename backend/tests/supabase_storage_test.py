import asyncio
import sys
import types
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if "httpx" not in sys.modules:
    sys.modules["httpx"] = types.SimpleNamespace(AsyncClient=None)
if "dotenv" not in sys.modules:
    sys.modules["dotenv"] = types.SimpleNamespace(
        load_dotenv=lambda *_, **__: None
    )

from backend.utils import supabase_storage


class _FakeResponse:
    def __init__(self, status_code: int, text: str = "", payload: dict | None = None):
        self.status_code = status_code
        self.text = text
        self._payload = payload or {}

    def json(self) -> dict:
        return self._payload


def _patch_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        supabase_storage, "get_supabase_url", lambda: "https://example.supabase.co"
    )
    monkeypatch.setattr(
        supabase_storage, "get_supabase_service_role_key", lambda: "service-role-key"
    )
    monkeypatch.setattr(supabase_storage, "get_supabase_storage_bucket", lambda: "audio")


def _patch_async_client(
    monkeypatch: pytest.MonkeyPatch, responses: list[_FakeResponse], calls: list[dict]
) -> None:
    class _FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, content=None, json=None):
            calls.append(
                {
                    "url": url,
                    "headers": headers,
                    "content": content,
                    "json": json,
                }
            )
            if not responses:
                raise AssertionError("No fake response queued for AsyncClient.post")
            return responses.pop(0)

    monkeypatch.setattr(supabase_storage.httpx, "AsyncClient", lambda **_: _FakeAsyncClient())


def test_upload_storage_object_success(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)
    calls: list[dict] = []
    responses = [_FakeResponse(200, "ok")]
    _patch_async_client(monkeypatch, responses, calls)

    result = asyncio.run(
        supabase_storage.upload_storage_object(
            "daily-notes/user one/audio sample.webm", b"abc", "audio/webm"
        )
    )

    assert result["path"] == "daily-notes/user one/audio sample.webm"
    assert (
        result["publicUrl"]
        == "https://example.supabase.co/storage/v1/object/public/audio/"
        "daily-notes/user%20one/audio%20sample.webm"
    )
    assert calls[0]["url"] == (
        "https://example.supabase.co/storage/v1/object/audio/"
        "daily-notes/user%20one/audio%20sample.webm"
    )
    assert calls[0]["headers"]["Authorization"] == "Bearer service-role-key"
    assert calls[0]["content"] == b"abc"


def test_upload_storage_object_empty_bytes_raises(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)

    with pytest.raises(supabase_storage.SupabaseStorageError, match="Upload file is empty"):
        asyncio.run(
            supabase_storage.upload_storage_object(
                "daily-notes/test.webm", b"", "audio/webm"
            )
        )


def test_upload_storage_object_http_error_raises(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)
    calls: list[dict] = []
    responses = [_FakeResponse(403, "denied")]
    _patch_async_client(monkeypatch, responses, calls)

    with pytest.raises(
        supabase_storage.SupabaseStorageError, match="Supabase upload failed"
    ):
        asyncio.run(
            supabase_storage.upload_storage_object(
                "daily-notes/test.webm", b"bytes", "audio/webm"
            )
        )


def test_create_storage_signed_url_with_absolute_url(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)
    calls: list[dict] = []
    responses = [
        _FakeResponse(
            200, payload={"signedURL": "https://example.supabase.co/storage/v1/object/sign/audio/path?token=t"}
        )
    ]
    _patch_async_client(monkeypatch, responses, calls)

    signed_url = asyncio.run(
        supabase_storage.create_storage_signed_url("daily-notes/u/a.webm", expires_in=120)
    )

    assert signed_url.startswith("https://example.supabase.co/storage/v1/object/sign/audio/")
    assert calls[0]["json"] == {"expiresIn": 120}


def test_create_storage_signed_url_with_relative_object_path(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)
    calls: list[dict] = []
    responses = [_FakeResponse(200, payload={"signedURL": "/object/sign/audio/x.webm?token=t"})]
    _patch_async_client(monkeypatch, responses, calls)

    signed_url = asyncio.run(supabase_storage.create_storage_signed_url("daily-notes/x.webm"))

    assert (
        signed_url
        == "https://example.supabase.co/storage/v1/object/sign/audio/x.webm?token=t"
    )


def test_create_storage_signed_url_invalid_payload_raises(monkeypatch: pytest.MonkeyPatch):
    _patch_config(monkeypatch)
    calls: list[dict] = []
    responses = [_FakeResponse(200, payload={})]
    _patch_async_client(monkeypatch, responses, calls)

    with pytest.raises(
        supabase_storage.SupabaseStorageError, match="response was invalid"
    ):
        asyncio.run(supabase_storage.create_storage_signed_url("daily-notes/x.webm"))
