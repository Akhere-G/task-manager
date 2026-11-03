"""Add task_reminders and move the reminded marker onto them.

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_reminders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("minutes_before", sa.Integer()),
        sa.Column("days_before", sa.Integer()),
        sa.Column("time_of_day", sa.Time()),
        sa.Column("zone_name", sa.String(64)),
        sa.Column("fire_at", sa.DateTime()),
        sa.Column("fired_for_start_at", sa.DateTime()),
    )
    op.create_index("idx_task_reminders_task", "task_reminders", ["task_id"])
    op.create_index("idx_task_reminders_fire_at", "task_reminders", ["fire_at"])
    op.execute(
        """
        INSERT INTO task_reminders
            (task_id, kind, minutes_before, fire_at, fired_for_start_at)
        SELECT id, 'before', 30, DATE_SUB(start_at, INTERVAL 30 MINUTE),
               reminded_for_start_at
        FROM tasks
        WHERE start_at IS NOT NULL
          AND is_completed = 0
          AND is_deleted = 0
          AND parent_id IS NULL
        """
    )
    op.drop_column("tasks", "reminded_for_start_at")


def downgrade() -> None:
    op.add_column("tasks", sa.Column("reminded_for_start_at", sa.DateTime()))
    op.execute(
        """
        UPDATE tasks
        JOIN (
            SELECT task_id, MAX(fired_for_start_at) AS fired
            FROM task_reminders
            GROUP BY task_id
        ) r ON r.task_id = tasks.id
        SET tasks.reminded_for_start_at = r.fired
        """
    )
    op.drop_table("task_reminders")
