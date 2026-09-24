import time
import uuid
from typing import Dict, Any, Optional
import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
from app.core.config import settings

# Configure Cloudinary SDK
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

class CloudinaryService:
    @staticmethod
    def generate_upload_signature(folder: str, public_id: Optional[str] = None, immutable: bool = False) -> Dict[str, Any]:
        """
        Generates server-side signed parameters for direct browser-to-Cloudinary upload.
        CLOUDINARY_API_SECRET is kept strictly on the backend.
        """
        timestamp = int(time.time())
        public_id = public_id or uuid.uuid4().hex
        
        # Parameters to include in Cloudinary signature
        params_to_sign = {
            "folder": folder,
            "public_id": public_id,
            "timestamp": timestamp,
        }
        
        if immutable:
            params_to_sign["overwrite"] = False

        signature = cloudinary.utils.api_sign_request(
            params_to_sign,
            settings.CLOUDINARY_API_SECRET
        )
        
        return {
            "overwrite": False if immutable else None,
            "signature": signature,
            "timestamp": timestamp,
            "api_key": settings.CLOUDINARY_API_KEY,
            "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
            "folder": folder,
            "public_id": public_id,
            "upload_url": f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload"
        }

    @staticmethod
    def get_asset(public_id: str) -> Dict[str, Any]:
        # Admin API: authoritative metadata, not client-supplied upload fields.
        return cloudinary.api.resource(public_id, resource_type="image", type="upload", timeout=20)

    @staticmethod
    def delete_asset(public_id: str) -> bool:
        """
        Safely removes an asset from Cloudinary when Memory or Space is deleted.
        """
        try:
            result = cloudinary.uploader.destroy(public_id, invalidate=True)
            return result.get("result") in ["ok", "not found"]
        except Exception as e:
            # Document and log error; do not let Cloudinary network hiccup block DB transaction
            print(f"Warning: Failed to delete Cloudinary asset {public_id}: {e}")
            return False

    @staticmethod
    def transform_url(public_id: str, transformation: str) -> str:
        """Derives a transformed URL for a given public ID."""
        return cloudinary.utils.cloudinary_url(
            public_id,
            transformation=transformation,
            secure=True
        )[0]

cloudinary_service = CloudinaryService()
