from datetime import date, datetime
from sqlalchemy import String, DateTime, Date, Boolean, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(nullable=True)
    category: Mapped[str] = mapped_column(
        Enum(
            "work",
            "home",
            "chores",
            "life-admin",
            "health",
            "self-care",
            "social",
            "hobbies",
            "learning",
            "finance",
            "general",
            name="category_enum",
        ),
        nullable=False,
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean, server_default="0", nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_repeating: Mapped[bool] = mapped_column(
        Boolean, server_default="0", nullable=False
    )
    repeat_by: Mapped[str | None] = mapped_column(
        Enum("daily", "weekly", "monthly", "yearly", name="repeat_by_enum"),
        nullable=True,
    )
    repeat_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
