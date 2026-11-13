from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import (
    DEFAULT_COLUMN_COLOUR,
    MAX_COLUMN_NAME_LENGTH,
    MAX_COLUMN_STATUS_LENGTH,
)
from app.database import Base


class OnDrop(StrEnum):
    NOTHING = "nothing"
    COMPLETE = "complete"
    UNCOMPLETE = "uncomplete"
    DELETE = "delete"


class ProjectColumn(Base):
    __tablename__ = "project_columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(MAX_COLUMN_NAME_LENGTH))
    status: Mapped[str] = mapped_column(String(MAX_COLUMN_STATUS_LENGTH))
    colour: Mapped[str] = mapped_column(
        String(7), default=DEFAULT_COLUMN_COLOUR, server_default=DEFAULT_COLUMN_COLOUR
    )
    on_drop: Mapped[OnDrop] = mapped_column(
        Enum(OnDrop, values_callable=lambda e: [m.value for m in e], name="on_drop"),
        default=OnDrop.NOTHING,
        server_default=OnDrop.NOTHING.value,
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_project_columns_name"),
    )
