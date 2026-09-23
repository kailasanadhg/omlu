import os
import uuid
import hmac
import hashlib
import time
from typing import Optional, Dict, Any
import boto3
from botocore.config import Config
from app.core.config import settings

class StorageService:
    def __init__(self):
        self.provider = settings.STORAGE_PROVIDER
        self.local_dir = settings.LOCAL_STORAGE_DIR
        os.makedirs(self.local_dir, exist_ok=True)
        
        self._s3_client = None
        if self.provider == "s3":
            s3_config = Config(signature_version="s3v4")
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
                config=s3_config
            )

    def generate_object_key(self, folder: str, filename: str) -> str:
        """Never trust original filenames. Generate unique random UUID-based keys."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        if ext not in ["jpg", "jpeg", "png", "webp", "gif"]:
            ext = "jpg"
        random_id = uuid.uuid4().hex
        return f"{folder}/{random_id}.{ext}"

    def create_upload_token(self, object_key: str, expires_in: int = 900) -> str:
        expire_at = int(time.time()) + expires_in
        payload = f"{object_key}:{expire_at}"
        sig = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return f"{payload}:{sig}"

    def verify_upload_token(self, token: str) -> Optional[str]:
        try:
            parts = token.split(":")
            if len(parts) != 3:
                return None
            object_key, expire_at_str, sig = parts
            expire_at = int(expire_at_str)
            if time.time() > expire_at:
                return None
            expected_payload = f"{object_key}:{expire_at_str}"
            expected_sig = hmac.new(settings.SECRET_KEY.encode(), expected_payload.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, expected_sig):
                return object_key
            return None
        except Exception:
            return None

    def get_public_url(self, object_key: str) -> str:
        if self.provider == "s3":
            if settings.MEDIA_BASE_URL:
                return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{object_key}"
            if settings.S3_ENDPOINT_URL:
                return f"{settings.S3_ENDPOINT_URL.rstrip('/')}/{settings.S3_BUCKET_NAME}/{object_key}"
            return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.S3_REGION}.amazonaws.com/{object_key}"
        else:
            return f"{settings.BACKEND_URL}/api/v1/media/file/{object_key}"

    def generate_presigned_upload(self, object_key: str, content_type: str) -> Dict[str, Any]:
        """Generate presigned upload URL for direct browser-to-storage upload."""
        public_url = self.get_public_url(object_key)
        
        if self.provider == "s3" and self._s3_client:
            presigned_url = self._s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=900
            )
            return {
                "upload_url": presigned_url,
                "object_key": object_key,
                "public_url": public_url,
                "method": "PUT",
                "headers": {"Content-Type": content_type}
            }
        else:
            token = self.create_upload_token(object_key)
            upload_url = f"{settings.BACKEND_URL}/api/v1/media/upload/{token}"
            return {
                "upload_url": upload_url,
                "object_key": object_key,
                "public_url": public_url,
                "method": "PUT",
                "headers": {"Content-Type": content_type}
            }

storage_service = StorageService()
