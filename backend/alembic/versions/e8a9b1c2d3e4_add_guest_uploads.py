"""Add guest uploads to spaces, memories, and upload_sessions.

Revision ID: e8a9b1c2d3e4
Revises: d7f4a6c91b02
Create Date: 2026-09-26 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e8a9b1c2d3e4"
down_revision = "d7f4a6c91b02"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Update spaces table
    op.add_column("spaces", sa.Column("guest_uploads_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("spaces", sa.Column("guest_token", sa.String(64), nullable=True))
    op.create_index("ix_spaces_guest_token", "spaces", ["guest_token"], unique=True)

    # 2. Update memories table
    op.alter_column("memories", "author_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column("memories", sa.Column("is_guest", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("memories", sa.Column("contributor_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_memories_contributor_user", "memories", "users", ["contributor_user_id"], ["id"], ondelete="SET NULL")
    op.add_column("memories", sa.Column("guest_session_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_memories_guest_session_id", "memories", ["guest_session_id"], unique=False)
    op.create_index(
        "ix_memories_space_guest_client",
        "memories",
        ["space_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("is_guest = true AND client_id IS NOT NULL"),
    )

    # 3. Update upload_sessions table
    op.alter_column("upload_sessions", "user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column("upload_sessions", sa.Column("is_guest", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("upload_sessions", sa.Column("guest_session_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade():
    # Revert upload_sessions
    op.drop_column("upload_sessions", "guest_session_id")
    op.drop_column("upload_sessions", "is_guest")
    op.alter_column("upload_sessions", "user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    # Revert memories
    op.drop_index("ix_memories_space_guest_client", table_name="memories")
    op.drop_index("ix_memories_guest_session_id", table_name="memories")
    op.drop_column("memories", "guest_session_id")
    op.drop_constraint("fk_memories_contributor_user", "memories", type_="foreignkey")
    op.drop_column("memories", "contributor_user_id")
    op.drop_column("memories", "is_guest")
    op.alter_column("memories", "author_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    # Revert spaces
    op.drop_index("ix_spaces_guest_token", table_name="spaces")
    op.drop_column("spaces", "guest_token")
    op.drop_column("spaces", "guest_uploads_enabled")
