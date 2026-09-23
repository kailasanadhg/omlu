import uuid
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

class CloudinarySignRequest(BaseModel):
    purpose: Literal["memory", "avatar", "space_cover"]
    space_id: Optional[uuid.UUID] = None

class CloudinarySignResponse(BaseModel):
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    upload_url: str

class MediaItemCreate(BaseModel):
    cloudinary_public_id: str
    cloudinary_asset_id: Optional[str] = None
    secure_url: str
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
