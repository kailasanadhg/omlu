import uuid
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.media import MediaItemCreate, MediaItemOut
from app.schemas.note import NoteOut

class MemoryPresentation(BaseModel):
    display_shape: Literal["portrait_9_16", "portrait_3_4", "square", "landscape_4_3", "circle"]
    crop_x: float = Field(ge=0, le=1, allow_inf_nan=False)
    crop_y: float = Field(ge=0, le=1, allow_inf_nan=False)
    crop_width: float = Field(gt=0, le=1, allow_inf_nan=False)
    crop_height: float = Field(gt=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def fits_inside_original(self):
        if self.crop_x + self.crop_width > 1.000001 or self.crop_y + self.crop_height > 1.000001:
            raise ValueError("Crop rectangle must fit inside the original photo")
        return self


class MemoryCreate(BaseModel):
    client_id: Optional[uuid.UUID] = None
    space_id: uuid.UUID
    caption: Optional[str] = Field(None, max_length=2200)
    memory_date: Optional[date] = None
    media_items: List[MediaItemCreate] = Field(..., min_length=1, max_length=10)
    presentation: Optional[MemoryPresentation] = None

class MemoryOut(BaseModel):
    client_id: Optional[uuid.UUID] = None
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
    presentation: Optional[MemoryPresentation] = None
    likes_count: int = 0
    is_liked_by_me: bool = False
    comments_count: int = 0
    notes: List[NoteOut] = []
    can_contribute: bool = False
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)

class LikeToggleOut(BaseModel):
    memory_id: uuid.UUID
    is_liked: bool
    likes_count: int


class RecentSpaceMemoryOut(BaseModel):
    id: uuid.UUID
    space_id: uuid.UUID
    created_at: datetime
    image_url: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    presentation: Optional[MemoryPresentation] = None


class RecentSpaceMemoriesOut(BaseModel):
    server_time: datetime
    memories: List[RecentSpaceMemoryOut]
