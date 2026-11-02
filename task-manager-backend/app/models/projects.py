from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import DEFAULT_PROJECT_COLOUR, MAX_PROJECT_NAME_LENGTH
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(MAX_PROJECT_NAME_LENGTH))
    colour: Mapped[str] = mapped_column(
        String(7), default=DEFAULT_PROJECT_COLOUR, server_default=DEFAULT_PROJECT_COLOUR
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("user_id", "parent_id", "name", name="uq_projects_name"),
    )
