import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.media import MediaItemCreate, MediaItemOut
from app.schemas.note import NoteOut

class MemoryCreate(BaseModel):
    space_id: uuid.UUID
    caption: Optional[str] = Field(None, max_length=2200)
    memory_date: Optional[date] = None
    media_items: List[MediaItemCreate] = Field(..., min_length=1, max_length=10)

class MemoryOut(BaseModel):
    id: uuid.UUID
    space_id: uuid.UUID
    space_name: str
    author_id: uuid.UUID
    author_username: str
    author_display_name: str
    author_avatar_url: Optional[str] = None
    caption: Optional[str] = None
    memory_date: date
    created_at: datetime
    media_items: List[MediaItemOut]
    likes_count: int = 0
    is_liked_by_me: bool = False
    comments_count: int = 0
    notes: List[NoteOut] = []
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)

class LikeToggleOut(BaseModel):
    memory_id: uuid.UUID
    is_liked: bool
    likes_count: int
