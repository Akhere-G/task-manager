"""Index tasks for per-column and per-priority board listings.

Revision ID: 0013
Revises: 0012
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_tasks_user_column_order",
        "tasks",
        ["user_id", "project_id", "column_id", "sort_order"],
    )
    op.create_index(
        "idx_tasks_user_priority_order", "tasks", ["user_id", "priority", "sort_order"]
    )


def downgrade() -> None:
    op.drop_index("idx_tasks_user_priority_order", table_name="tasks")
    op.drop_index("idx_tasks_user_column_order", table_name="tasks")
