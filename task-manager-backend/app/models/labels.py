from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import DEFAULT_LABEL_COLOUR, MAX_LABEL_NAME_LENGTH
from app.database import Base


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(MAX_LABEL_NAME_LENGTH))
    colour: Mapped[str] = mapped_column(
        String(7), default=DEFAULT_LABEL_COLOUR, server_default=DEFAULT_LABEL_COLOUR
    )

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_labels_name"),)


class TaskLabel(Base):
    __tablename__ = "task_labels"

    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    label_id: Mapped[int] = mapped_column(
        ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True
    )
