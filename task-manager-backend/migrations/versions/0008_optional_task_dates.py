"""Make task start and end optional so undated tasks can live in the inbox.

Revision ID: 0008
Revises: 0007
"""

from alembic import op
from sqlalchemy.dialects import mysql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column in ("start_at", "end_at"):
        op.alter_column(
            "tasks",
            column,
            existing_type=mysql.TIMESTAMP(),
            nullable=True,
            server_default=None,
        )


def downgrade() -> None:
    op.execute("UPDATE tasks SET start_at = created_at WHERE start_at IS NULL")
    op.execute(
        "UPDATE tasks SET end_at = DATE_ADD(created_at, INTERVAL 30 MINUTE) "
        "WHERE end_at IS NULL"
    )
    for column in ("start_at", "end_at"):
        op.alter_column(
            "tasks",
            column,
            existing_type=mysql.TIMESTAMP(),
            nullable=False,
            server_default=None,
        )
