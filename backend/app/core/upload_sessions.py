import asyncio
import hashlib
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from cloudinary.exceptions import NotFound, Error as CloudinaryError
from app.core.cloudinary_service import cloudinary_service
from app.models.upload_session import UploadSession


async def lock_identity(db: AsyncSession, identity: str):
    # Transaction-scoped across all API workers; uniqueness is also enforced in DB.
    key = int.from_bytes(hashlib.sha256(identity.encode()).digest()[:8], "big", signed=True)
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})


async def verify_asset(session: UploadSession) -> dict:
    if session.verified_asset is not None:
        return session.verified_asset
    try:
        asset = await asyncio.to_thread(cloudinary_service.get_asset, session.public_id)
    except NotFound:
        raise HTTPException(404, "Upload has not completed")
    except (CloudinaryError, OSError, TimeoutError):
        raise HTTPException(503, "Could not verify upload; retry later")
    if (asset.get("public_id") != session.public_id or asset.get("resource_type") != "image"
            or asset.get("type") != "upload" or not asset.get("secure_url", "").startswith("https://")
            or not asset.get("asset_id") or not asset.get("format")
            or not isinstance(asset.get("width"), int) or asset["width"] <= 0
            or not isinstance(asset.get("height"), int) or asset["height"] <= 0
            or not isinstance(asset.get("bytes"), int) or not 0 < asset["bytes"] <= 25 * 1024 * 1024):
        raise HTTPException(422, "Uploaded asset is not a supported image (maximum 25 MB)")
    session.verified_asset = {key: asset[key] for key in (
        "public_id", "asset_id", "secure_url", "resource_type", "format", "width", "height", "bytes"
    )}
    return session.verified_asset
