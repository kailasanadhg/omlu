"""Private-by-default Space visibility; preserve all existing identities and relationships."""
from alembic import op
import sqlalchemy as sa

revision = "c24a91d8e602"
down_revision = "b13e7a2f901c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("spaces", sa.Column("visibility", sa.String(7), nullable=False, server_default="private"))
    op.create_check_constraint("ck_space_visibility", "spaces", "visibility IN ('public', 'private')")
    op.create_index("ix_memories_space_collection", "memories", ["space_id", "memory_date", "created_at", "id"])
    op.create_index("ix_memories_author_collection", "memories", ["author_id", "memory_date", "created_at", "id"])


def downgrade():
    op.drop_index("ix_memories_author_collection", table_name="memories")
    op.drop_index("ix_memories_space_collection", table_name="memories")
    op.drop_constraint("ck_space_visibility", "spaces", type_="check")
    op.drop_column("spaces", "visibility")
