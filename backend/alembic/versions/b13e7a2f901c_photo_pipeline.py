"""Idempotent Memories and owner-bound image upload sessions.

Revision ID: b13e7a2f901c
Revises: 47b067eb6940
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b13e7a2f901c"
down_revision = "47b067eb6940"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("memories", sa.Column("client_id", sa.UUID(), nullable=True))
    op.add_column("memories", sa.Column("request_hash", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_memory_author_client", "memories", ["author_id", "client_id"])
    op.create_table("upload_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("space_id", sa.UUID(), sa.ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("public_id", sa.String(255), nullable=False, unique=True),
        sa.Column("memory_id", sa.UUID(), nullable=True),
        sa.Column("verified_asset", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_upload_sessions_user_id", "upload_sessions", ["user_id"])
    op.create_index("ix_upload_sessions_space_id", "upload_sessions", ["space_id"])


def downgrade():
    op.drop_table("upload_sessions")
    op.drop_constraint("uq_memory_author_client", "memories", type_="unique")
    op.drop_column("memories", "request_hash")
    op.drop_column("memories", "client_id")
