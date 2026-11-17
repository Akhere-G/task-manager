"""Views: the inbox narrows a list to tasks that belong to no project."""

from sqlalchemy import ColumnElement

from app.models import Task

TASK_VIEWS = ("inbox", "all")


def view_clause(view: str | None) -> ColumnElement[bool] | None:
    if view == "inbox":
        return Task.project_id.is_(None)
    return None
