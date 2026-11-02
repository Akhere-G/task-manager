"""Add a P1 to P4 priority to tasks; existing tasks become P4.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("priority", sa.SmallInteger(), server_default="4", nullable=False),
    )
    op.create_check_constraint("ck_tasks_priority", "tasks", "priority BETWEEN 1 AND 4")


def downgrade() -> None:
    op.drop_constraint("ck_tasks_priority", "tasks", type_="check")
    op.drop_column("tasks", "priority")
