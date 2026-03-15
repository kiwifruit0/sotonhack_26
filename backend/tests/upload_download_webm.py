# save as /tmp/upload_download_webm.py
import asyncio
from pathlib import Path

import httpx
from backend.utils.supabase_storage import (
    create_storage_signed_url,
    upload_storage_object,
)

LOCAL_WEBM = Path("/home/kiwi/Downloads/test_beep.webm")
STORAGE_PATH = f"manual-uploads/{LOCAL_WEBM.name}"


async def main():
    data = LOCAL_WEBM.read_bytes()
    upload = await upload_storage_object(STORAGE_PATH, data, "audio/webm")
    print("Uploaded:", upload["path"])
    print("Public URL:", upload["publicUrl"])

    signed = await create_storage_signed_url(upload["path"], expires_in=3600)
    print("Signed URL:", signed)

    async with httpx.AsyncClient() as c:
        r = await c.get(signed)
        r.raise_for_status()
    Path("downloaded.webm").write_bytes(r.content)
    print("Saved downloaded.webm")


asyncio.run(main())
