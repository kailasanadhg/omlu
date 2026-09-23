from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import re
import bcrypt
import jwt
from app.core.config import settings

RESERVED_USERNAMES = {
    "admin", "administrator", "root", "system", "omlu", "api", "auth",
    "login", "signup", "settings", "profile", "spaces", "memories", "feed",
    "explore", "activity", "support", "help", "about", "terms", "privacy",
    "user", "users", "null", "undefined", "bot", "official"
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None

def normalize_username(username: str) -> str:
    """Strip leading @, trim whitespace, and convert to lowercase."""
    cleaned = username.strip().lstrip("@").lower()
    return cleaned

def validate_username(username: str) -> tuple[bool, str]:
    normalized = normalize_username(username)
    if len(normalized) < 3:
        return False, "Username must be at least 3 characters long"
    if len(normalized) > 30:
        return False, "Username cannot exceed 30 characters"
    if not re.match(r"^[a-z0-9_]+$", normalized):
        return False, "Username can only contain lowercase letters, numbers, and underscores"
    if normalized in RESERVED_USERNAMES:
        return False, f"Username '{normalized}' is reserved and cannot be chosen"
    return True, ""
