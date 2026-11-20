from datetime import date, datetime

from sqlalchemy import TIMESTAMP, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.dates import utc_now


class DailyBrief(Base):
    __tablename__ = "daily_briefs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    brief_text: Mapped[str] = mapped_column(Text)
    generated_date: Mapped[date]
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        nullable=True,
        default=utc_now,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "generated_date", name="unique_user_day"),
    )
