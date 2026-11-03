"""Add tasks.sort_order for manual ordering.

Revision ID: 0011
Revises: 0010
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

GAP = 1024


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("sort_order", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.create_index("idx_tasks_user_order", "tasks", ["user_id", "sort_order"])
    op.execute(
        f"""
        UPDATE tasks
        JOIN (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id ORDER BY created_at DESC, id DESC
                   ) AS place
            FROM tasks
        ) ranked ON ranked.id = tasks.id
        SET tasks.sort_order = ranked.place * {GAP}
        """
    )


def downgrade() -> None:
    op.drop_index("idx_tasks_user_order", table_name="tasks")
    op.drop_column("tasks", "sort_order")
