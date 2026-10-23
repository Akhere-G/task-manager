from datetime import date, datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), server_default="General")
    is_completed: Mapped[bool] = mapped_column(server_default="0")
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_repeating: Mapped[bool] = mapped_column(server_default="0")
    repeat_by: Mapped[str | None] = mapped_column(
        Enum("daily", "weekly", "monthly", "yearly", name="repeat_by_enum")
    )
    repeat_until: Mapped[date | None]
    series_id: Mapped[int | None]
    reminded_for_start_at: Mapped[datetime | None] = mapped_column(DateTime)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    __table_args__ = (
        Index("idx_tasks_search", "title", "description", mysql_prefix="FULLTEXT"),
        Index("idx_tasks_user_end_at", "user_id", "end_at"),
        Index("idx_tasks_user_completed", "user_id", "is_completed", "completed_at"),
    )
