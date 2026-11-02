"""Soft-delete tasks so they can be restored for 30 days.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("is_deleted", sa.Boolean(), server_default="0", nullable=False),
    )
    op.add_column("tasks", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index(
        "idx_tasks_user_deleted", "tasks", ["user_id", "is_deleted", "deleted_at"]
    )


def downgrade() -> None:
    op.execute("DELETE FROM tasks WHERE is_deleted = 1")
    op.drop_index("idx_tasks_user_deleted", table_name="tasks")
    op.drop_column("tasks", "deleted_at")
    op.drop_column("tasks", "is_deleted")
