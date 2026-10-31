from datetime import datetime
from sqlalchemy import CHAR, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_demo: Mapped[bool] = mapped_column(server_default="0")


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str | None] = mapped_column(CHAR(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_password_resets_token_hash", "token_hash"),
        Index("idx_password_resets_expires", "expires_at"),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str | None] = mapped_column(CHAR(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    replaced_at: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        Index("uq_refresh_tokens_token_hash", "token_hash", unique=True),
        Index("idx_refresh_tokens_expires", "expires_at"),
    )
