"""Add subtasks: tasks.parent_id and tasks.position.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_foreign_key(
        "fk_tasks_parent",
        "tasks",
        "tasks",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("idx_tasks_parent", "tasks", ["parent_id", "position"])


def downgrade() -> None:
    op.drop_constraint("fk_tasks_parent", "tasks", type_="foreignkey")
    op.drop_index("idx_tasks_parent", table_name="tasks")
    op.drop_column("tasks", "position")
    op.drop_column("tasks", "parent_id")
