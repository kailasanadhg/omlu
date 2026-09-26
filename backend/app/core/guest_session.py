import uuid
import hmac
import hashlib
from typing import Tuple
from app.core.config import settings

def create_guest_session() -> Tuple[uuid.UUID, str]:
    """Create a new server-verifiable guest session ID and claim token."""
    session_id = uuid.uuid4()
    claim_token = hmac.new(
        settings.SECRET_KEY.encode(),
        f"guest_claim:{session_id}".encode(),
        hashlib.sha256
    ).hexdigest()
    return session_id, claim_token

def verify_guest_claim_token(session_id: uuid.UUID, claim_token: str) -> bool:
    """Verify that the claim token was signed by our server for this guest session ID."""
    if not claim_token:
        return False
    expected = hmac.new(
        settings.SECRET_KEY.encode(),
        f"guest_claim:{session_id}".encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, claim_token)
