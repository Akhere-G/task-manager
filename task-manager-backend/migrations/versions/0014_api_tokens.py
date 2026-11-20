"""Add personal access tokens for the MCP endpoint.

Revision ID: 0014
Revises: 0013
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None

TOKEN_SCOPES = ("read", "write")


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("token_hash", sa.CHAR(64), nullable=False, unique=True),
        sa.Column("prefix", sa.String(8), nullable=False),
        sa.Column("scope", sa.Enum(*TOKEN_SCOPES, name="token_scope"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("idx_api_tokens_user", "api_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_api_tokens_user", table_name="api_tokens")
    op.drop_table("api_tokens")
    sa.Enum(name="token_scope").drop(op.get_bind(), checkfirst=True)
