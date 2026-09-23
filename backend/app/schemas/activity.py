import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class ActivityItemOut(BaseModel):
    id: uuid.UUID
    type: str  # "like", "comment", "joined_space"
    actor_id: uuid.UUID
    actor_username: str
    actor_display_name: str
    actor_avatar_url: Optional[str] = None
    memory_id: Optional[uuid.UUID] = None
    space_id: Optional[uuid.UUID] = None
    content: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
