import uuid
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=512)

class UserProfileOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    memories_count: int = 0
    spaces_count: int = 0
    is_self: bool = False

    model_config = ConfigDict(from_attributes=True)
