from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.dates import utc_now

from ..database import Base


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        default=utc_now,
        server_default=func.current_timestamp(),
        nullable=True,
    )


class NotificationSubscription(Base):
    __tablename__ = "notification_subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    endpoint: Mapped[str] = mapped_column(String(500), unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        default=utc_now,
        server_default=func.current_timestamp(),
        nullable=True,
    )
