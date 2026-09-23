import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    cover_url: Optional[str] = Field(None, max_length=512)

class SpaceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    owner_id: uuid.UUID
    invite_code: str
    members_count: int = 0
    memories_count: int = 0
    is_owner: bool = False
    is_member: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SpaceMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    role: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InvitePreviewOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    members_count: int = 0
    memories_count: int = 0
    invite_code: str
    is_member: bool = False
