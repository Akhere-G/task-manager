from datetime import datetime, time

from sqlalchemy import DateTime, ForeignKey, Index, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TaskReminder(Base):
    """A push reminder for a task: relative to its start, or at a clock time."""

    __tablename__ = "task_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(10))
    minutes_before: Mapped[int | None]
    days_before: Mapped[int | None]
    time_of_day: Mapped[time | None] = mapped_column(Time)
    zone_name: Mapped[str | None] = mapped_column(String(64))
    fire_at: Mapped[datetime | None] = mapped_column(DateTime)
    fired_for_start_at: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_task_reminders_task", "task_id"),
        Index("idx_task_reminders_fire_at", "fire_at"),
    )
