from datetime import date, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.mysql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import DEFAULT_PRIORITY
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Legacy: projects replaced categories. The column stays so the projects
    # migration can be rolled back; nothing reads or writes it.
    category: Mapped[str] = mapped_column(
        String(50), server_default="General", nullable=True
    )
    priority: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_PRIORITY, server_default=str(DEFAULT_PRIORITY)
    )
    is_completed: Mapped[bool] = mapped_column(server_default="0", nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, server_default=func.current_timestamp(), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    is_repeating: Mapped[bool] = mapped_column(server_default="0", nullable=True)
    repeat_by: Mapped[str | None] = mapped_column(
        Enum("daily", "weekly", "monthly", "yearly", name="repeat_by_enum")
    )
    repeat_until: Mapped[date | None]
    repeat_interval: Mapped[int] = mapped_column(server_default="1")
    repeat_days: Mapped[list | None] = mapped_column(JSON)
    repeat_timezone: Mapped[str | None] = mapped_column(String(64))
    series_id: Mapped[int | None]
    reminded_for_start_at: Mapped[datetime | None] = mapped_column(DateTime)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    is_deleted: Mapped[bool] = mapped_column(default=False, server_default="0")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    __table_args__ = (
        Index("idx_tasks_search", "title", "description", mysql_prefix="FULLTEXT"),
        Index("idx_tasks_user_end_at", "user_id", "end_at"),
        Index("idx_tasks_user_completed", "user_id", "is_completed", "completed_at"),
        Index("idx_tasks_user_project", "user_id", "project_id"),
        Index("idx_tasks_parent", "parent_id", "position"),
        Index("idx_tasks_user_deleted", "user_id", "is_deleted", "deleted_at"),
        CheckConstraint("priority BETWEEN 1 AND 4", name="ck_tasks_priority"),
    )
