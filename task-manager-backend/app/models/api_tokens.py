from datetime import datetime
from enum import StrEnum

from sqlalchemy import CHAR, TIMESTAMP, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import API_TOKEN_PREFIX_LENGTH, MAX_API_TOKEN_NAME_LENGTH
from app.database import Base


class TokenScope(StrEnum):
    READ = "read"
    WRITE = "write"

    def allows(self, required: "TokenScope") -> bool:
        return self is TokenScope.WRITE or required is TokenScope.READ


class ApiToken(Base):
    __tablename__ = "api_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(MAX_API_TOKEN_NAME_LENGTH))
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    prefix: Mapped[str] = mapped_column(String(API_TOKEN_PREFIX_LENGTH))
    scope: Mapped[TokenScope] = mapped_column(
        Enum(
            TokenScope,
            values_callable=lambda e: [m.value for m in e],
            name="token_scope",
        )
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, server_default=func.current_timestamp()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
