"""Baseline: the schema init_db.py produced in production.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

NOW = sa.text("CURRENT_TIMESTAMP")


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("first_name", sa.String(50), nullable=False),
        sa.Column("last_name", sa.String(50), nullable=False),
        sa.Column("email", sa.String(100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_demo", sa.Boolean, nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(50), server_default="General"),
        sa.Column("is_completed", sa.Boolean, server_default=sa.text("0")),
        sa.Column("start_at", mysql.TIMESTAMP, nullable=False),
        sa.Column("end_at", mysql.TIMESTAMP, nullable=False),
        sa.Column("created_at", mysql.TIMESTAMP, server_default=NOW),
        sa.Column("completed_at", mysql.TIMESTAMP, nullable=True),
        sa.Column("is_repeating", sa.Boolean, server_default=sa.text("0")),
        sa.Column(
            "repeat_by",
            sa.Enum("daily", "weekly", "monthly", "yearly", name="repeat_by_enum"),
        ),
        sa.Column("repeat_until", sa.Date),
        sa.Column("repeat_interval", sa.Integer, nullable=False, server_default="1"),
        sa.Column("repeat_days", sa.JSON),
        sa.Column("repeat_timezone", sa.String(64)),
        sa.Column("series_id", sa.Integer),
        sa.Column("reminded_for_start_at", sa.DateTime),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_user", ondelete="CASCADE"
        ),
    )
    op.create_index("idx_tasks_search", "tasks", ["title", "description"], mysql_prefix="FULLTEXT")
    op.create_index("idx_tasks_user_end_at", "tasks", ["user_id", "end_at"])
    op.create_index(
        "idx_tasks_user_completed", "tasks", ["user_id", "is_completed", "completed_at"]
    )

    op.create_table(
        "daily_briefs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("brief_text", sa.Text, nullable=False),
        sa.Column("generated_date", sa.Date, nullable=False),
        sa.Column("created_at", mysql.TIMESTAMP, server_default=NOW),
        sa.UniqueConstraint("user_id", "generated_date", name="unique_user_day"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_brief_user", ondelete="CASCADE"
        ),
    )

    op.create_table(
        "password_resets",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("token", sa.String(255), nullable=True),
        sa.Column("token_hash", sa.CHAR(64), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_password_resets_token_hash", "password_resets", ["token_hash"])
    op.create_index("idx_password_resets_expires", "password_resets", ["expires_at"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("token", sa.String(255), nullable=True),
        sa.Column("token_hash", sa.CHAR(64), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("replaced_at", sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "uq_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True
    )
    op.create_index("idx_refresh_tokens_expires", "refresh_tokens", ["expires_at"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, server_default=sa.text("0")),
        sa.Column("created_at", mysql.TIMESTAMP, server_default=NOW),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_notif_user", ondelete="CASCADE"
        ),
    )

    op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("endpoint", sa.String(500), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(255), nullable=False),
        sa.Column("auth", sa.String(255), nullable=False),
        sa.Column("created_at", mysql.TIMESTAMP, server_default=NOW),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sub_user", ondelete="CASCADE"
        ),
    )

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


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS tr_ensure_completion_timestamp")
    for table in (
        "notification_subscriptions",
        "notifications",
        "refresh_tokens",
        "password_resets",
        "daily_briefs",
        "tasks",
        "users",
    ):
        op.drop_table(table)
