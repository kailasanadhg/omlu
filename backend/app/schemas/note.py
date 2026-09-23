import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class NoteCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)

class NoteOut(BaseModel):
    id: uuid.UUID
    memory_id: uuid.UUID
    author_id: uuid.UUID
    author_username: str
    author_display_name: str
    author_avatar_url: Optional[str] = None
    body: str
    created_at: datetime
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)
