import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from sqlalchemy.dialects import postgresql

from app.api.v1.memories import get_recent_space_memories


class FakeDB:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return SimpleNamespace(all=lambda: self.rows)


def test_recent_endpoint_uses_one_membership_scoped_metadata_query():
    user = SimpleNamespace(id=uuid.uuid4())
    memory_id = uuid.uuid4()
    space_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)
    db = FakeDB([SimpleNamespace(
        id=memory_id, space_id=space_id, created_at=created_at,
        image_url="https://example.test/original.jpg",
        image_width=1200, image_height=800,
        display_shape=None, crop_x=None, crop_y=None,
        crop_width=None, crop_height=None,
    )])

    result = asyncio.run(get_recent_space_memories(current_user=user, db=db))

    assert len(result.memories) == 1
    assert result.memories[0].id == memory_id
    assert result.memories[0].image_url == "https://example.test/original.jpg"
    assert result.server_time.tzinfo is not None
    sql = str(db.statement.compile(dialect=postgresql.dialect()))
    assert "JOIN memberships" in sql
    assert "memories.created_at >" in sql
    assert "memories.created_at <=" in sql
    assert "SELECT media.secure_url" in sql
