from typing import Any

from sqlalchemy import func, select, update

from app.constants import DEFAULT_COLUMNS
from app.database import db
from app.exceptions import (
    ColumnNameTaken,
    ColumnNotFound,
    InvalidColumn,
    LastColumn,
    ProjectNotFound,
)
from app.models import OnDrop, Project, ProjectColumn, Task


def _ensure_project_belongs_to(user_id: int, project_id: int) -> None:
    owned = db.session.scalar(
        select(Project.id).where(Project.user_id == user_id, Project.id == project_id)
    )
    if owned is None:
        raise ProjectNotFound()


def create_default_columns(project_id: int) -> None:
    """Adds the starter columns without committing."""
    for position, (name, status, colour, on_drop) in enumerate(DEFAULT_COLUMNS):
        db.session.add(
            ProjectColumn(
                project_id=project_id,
                name=name,
                status=status,
                colour=colour,
                on_drop=OnDrop(on_drop),
                position=position,
            )
        )


def _columns_of(project_id: int) -> list[ProjectColumn]:
    stmt = (
        select(ProjectColumn)
        .where(ProjectColumn.project_id == project_id)
        .order_by(ProjectColumn.position, ProjectColumn.id)
    )
    return list(db.session.scalars(stmt))


def list_columns(user_id: int, project_id: int) -> list[ProjectColumn]:
    _ensure_project_belongs_to(user_id, project_id)
    columns = _columns_of(project_id)
    if not columns:
        create_default_columns(project_id)
        db.session.commit()
        columns = _columns_of(project_id)
    return columns


def get_column(user_id: int, column_id: int) -> ProjectColumn:
    column = db.session.scalar(
        select(ProjectColumn)
        .join(Project, Project.id == ProjectColumn.project_id)
        .where(Project.user_id == user_id, ProjectColumn.id == column_id)
    )
    if column is None:
        raise ColumnNotFound()
    return column


def first_column_id(project_id: int | None) -> int | None:
    if project_id is None:
        return None
    return db.session.scalar(
        select(ProjectColumn.id)
        .where(ProjectColumn.project_id == project_id)
        .order_by(ProjectColumn.position, ProjectColumn.id)
        .limit(1)
    )


def ensure_column_in_project(column_id: int | None, project_id: int | None) -> None:
    if column_id is None:
        return
    in_project = db.session.scalar(
        select(ProjectColumn.id).where(
            ProjectColumn.id == column_id, ProjectColumn.project_id == project_id
        )
    )
    if in_project is None:
        raise InvalidColumn()


def _check_name_free(project_id: int, name: str, except_id: int | None = None) -> None:
    stmt = select(ProjectColumn.id).where(
        ProjectColumn.project_id == project_id,
        func.lower(ProjectColumn.name) == name.lower(),
    )
    if except_id is not None:
        stmt = stmt.where(ProjectColumn.id != except_id)
    if db.session.scalar(stmt) is not None:
        raise ColumnNameTaken()


def create_column(user_id: int, project_id: int, data: dict[str, Any]) -> ProjectColumn:
    _ensure_project_belongs_to(user_id, project_id)
    _check_name_free(project_id, data["name"])
    last_position = db.session.scalar(
        select(func.max(ProjectColumn.position)).where(
            ProjectColumn.project_id == project_id
        )
    )
    data.setdefault("status", data["name"])
    column = ProjectColumn(
        **data,
        project_id=project_id,
        position=0 if last_position is None else last_position + 1,
    )
    db.session.add(column)
    db.session.commit()
    return column


def update_column(user_id: int, column_id: int, data: dict[str, Any]) -> ProjectColumn:
    column = get_column(user_id, column_id)
    if "name" in data:
        _check_name_free(column.project_id, data["name"], except_id=column.id)
    for field, value in data.items():
        setattr(column, field, value)
    db.session.commit()
    return column


def reorder_columns(
    user_id: int, project_id: int, column_ids: list[int]
) -> list[ProjectColumn]:
    columns = list_columns(user_id, project_id)
    if sorted(column_ids) != sorted(column.id for column in columns):
        raise InvalidColumn("Send every column of the project exactly once.")
    by_id = {column.id: column for column in columns}
    for position, column_id in enumerate(column_ids):
        by_id[column_id].position = position
    db.session.commit()
    return [by_id[column_id] for column_id in column_ids]


def delete_column(user_id: int, column_id: int, move_to_id: int) -> None:
    column = get_column(user_id, column_id)
    if len(_columns_of(column.project_id)) == 1:
        raise LastColumn()
    if move_to_id == column.id:
        raise InvalidColumn("Choose a different column for its tasks.")
    ensure_column_in_project(move_to_id, column.project_id)
    db.session.execute(
        update(Task).where(Task.column_id == column.id).values(column_id=move_to_id)
    )
    db.session.delete(column)
    db.session.commit()
