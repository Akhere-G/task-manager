"""Drop the plaintext token columns; only token_hash is used.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("refresh_tokens", "token")
    op.drop_column("password_resets", "token")


def downgrade():
    op.add_column("password_resets", sa.Column("token", sa.String(255), nullable=True))
    op.add_column("refresh_tokens", sa.Column("token", sa.String(255), nullable=True))
