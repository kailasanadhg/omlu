import uuid
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

class CloudinarySignRequest(BaseModel):
    upload_session_id: Optional[uuid.UUID] = None
    purpose: Literal["memory", "avatar", "space_cover"]
    space_id: Optional[uuid.UUID] = None

class GuestCloudinarySignRequest(BaseModel):
    guest_token: str
    upload_session_id: Optional[uuid.UUID] = None


class CloudinarySignResponse(BaseModel):
    upload_session_id: Optional[uuid.UUID] = None
    overwrite: Optional[bool] = None
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    upload_url: str

class MediaItemCreate(BaseModel):
    upload_session_id: Optional[uuid.UUID] = None
    cloudinary_public_id: Optional[str] = None
    cloudinary_asset_id: Optional[str] = None
    secure_url: Optional[str] = None
    resource_type: str = "image"
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    bytes: Optional[int] = None
    position: int = Field(default=0, ge=0)

class MediaItemOut(BaseModel):
    id: uuid.UUID
    cloudinary_public_id: str
    secure_url: str
    resource_type: str
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    position: int

    model_config = ConfigDict(from_attributes=True)
