from urllib.parse import quote

import httpx

from .dotenv_utils import (
    get_supabase_service_role_key,
    get_supabase_storage_bucket,
    get_supabase_url,
)


class SupabaseStorageError(RuntimeError):
    pass


def _require_supabase_config() -> tuple[str, str, str]:
    supabase_url = get_supabase_url()
    service_role_key = get_supabase_service_role_key()
    bucket_name = get_supabase_storage_bucket()

    if not supabase_url:
        raise SupabaseStorageError("SUPABASE_URL is not set")
    if not service_role_key:
        raise SupabaseStorageError("SUPABASE_SERVICE_ROLE_KEY is not set")
    if not bucket_name:
        raise SupabaseStorageError("SUPABASE_STORAGE_BUCKET is not set")

    return supabase_url.rstrip("/"), service_role_key, bucket_name


async def upload_storage_object(
    storage_path: str, file_bytes: bytes, content_type: str
) -> dict[str, str]:
    if not file_bytes:
        raise SupabaseStorageError("Upload file is empty")

    supabase_url, service_role_key, bucket_name = _require_supabase_config()
    encoded_path = quote(storage_path, safe="/")
    upload_url = f"{supabase_url}/storage/v1/object/{bucket_name}/{encoded_path}"

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "x-upsert": "false",
        "Content-Type": content_type,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(upload_url, headers=headers, content=file_bytes)

    if response.status_code >= 400:
        raise SupabaseStorageError(
            f"Supabase upload failed ({response.status_code}): {response.text}"
        )

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{encoded_path}"
    return {"path": storage_path, "publicUrl": public_url}


async def create_storage_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    supabase_url, service_role_key, bucket_name = _require_supabase_config()
    encoded_path = quote(storage_path, safe="/")
    sign_url = f"{supabase_url}/storage/v1/object/sign/{bucket_name}/{encoded_path}"

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            sign_url, headers=headers, json={"expiresIn": expires_in}
        )

    if response.status_code >= 400:
        raise SupabaseStorageError(
            f"Supabase signed URL failed ({response.status_code}): {response.text}"
        )

    payload = response.json()
    signed_url = payload.get("signedURL")
    if not isinstance(signed_url, str) or not signed_url:
        raise SupabaseStorageError("Supabase signed URL response was invalid")

    if signed_url.startswith("http"):
        return signed_url

    # Supabase may return a path beginning with /object/sign/... which still needs
    # the /storage/v1 prefix when converted to an absolute URL.
    normalized = signed_url if signed_url.startswith("/") else f"/{signed_url}"
    if normalized.startswith("/object/"):
        normalized = f"/storage/v1{normalized}"
    return f"{supabase_url}{normalized}"
