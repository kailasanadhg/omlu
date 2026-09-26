"""Store non-destructive Drop presentation on memories; leave legacy rows unset."""
from alembic import op
import sqlalchemy as sa

revision = "d7f4a6c91b02"
down_revision = "c24a91d8e602"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("memories", sa.Column("display_shape", sa.String(20), nullable=True))
    for name in ("crop_x", "crop_y", "crop_width", "crop_height"):
        op.add_column("memories", sa.Column(name, sa.Float(), nullable=True))
    op.create_check_constraint(
        "ck_memory_presentation_complete", "memories",
        "(display_shape IS NULL AND crop_x IS NULL AND crop_y IS NULL AND crop_width IS NULL AND crop_height IS NULL) "
        "OR (display_shape IN ('portrait_9_16', 'portrait_3_4', 'square', 'landscape_4_3', 'circle') "
        "AND crop_x IS NOT NULL AND crop_y IS NOT NULL AND crop_width IS NOT NULL AND crop_height IS NOT NULL)",
    )


def downgrade():
    op.drop_constraint("ck_memory_presentation_complete", "memories", type_="check")
    for name in ("crop_height", "crop_width", "crop_y", "crop_x", "display_shape"):
        op.drop_column("memories", name)
