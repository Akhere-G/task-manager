"""Make task start and end optional so undated tasks can live in the inbox.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column in ("start_at", "end_at"):
        op.alter_column(
            "tasks",
            column,
            existing_type=sa.TIMESTAMP(),
            nullable=True,
            server_default=None,
        )


def downgrade() -> None:
    op.execute("UPDATE tasks SET start_at = created_at WHERE start_at IS NULL")
    op.execute(
        "UPDATE tasks SET end_at = created_at + INTERVAL '30 minutes' "
        "WHERE end_at IS NULL"
    )
    for column in ("start_at", "end_at"):
        op.alter_column(
            "tasks",
            column,
            existing_type=sa.TIMESTAMP(),
            nullable=False,
            server_default=None,
        )
