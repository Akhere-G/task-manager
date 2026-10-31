"""The app owns is_completed / completed_at; drop the completion trigger.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE tasks SET completed_at = NULL WHERE is_completed = 0")
    op.execute(
        "UPDATE tasks SET completed_at = COALESCE(completed_at, NOW()) "
        "WHERE is_completed = 1"
    )
    op.execute("DROP TRIGGER IF EXISTS tr_ensure_completion_timestamp")


def downgrade() -> None:
    op.execute(
        """
        CREATE TRIGGER tr_ensure_completion_timestamp
        BEFORE UPDATE ON tasks
        FOR EACH ROW
        BEGIN
            IF NEW.is_completed = 1 AND NEW.completed_at IS NULL THEN
                SET NEW.completed_at = NOW();
            ELSEIF NEW.is_completed = 0 THEN
                SET NEW.completed_at = NULL;
            END IF;
        END
        """
    )
