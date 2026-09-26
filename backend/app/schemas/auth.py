import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    display_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    guest_session_id: Optional[uuid.UUID] = None
    guest_claim_token: Optional[str] = None

class ClaimGuestRequest(BaseModel):
    guest_session_id: uuid.UUID
    guest_claim_token: str

class ClaimGuestResponse(BaseModel):
    claimed_count: int

class LoginRequest(BaseModel):
    email_or_username: str
    password: str

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
