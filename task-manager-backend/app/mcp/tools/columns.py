from typing import Any

from marshmallow import fields, validate

from app.mcp.registry import Tool
from app.models import TokenScope
from app.schemas.base import CamelSchema
from app.schemas.column_schema import (
    BoardMoveSchema,
    ColumnDeleteSchema,
    ColumnOrderSchema,
    ColumnSchema,
    ColumnUpdateSchema,
)
from app.schemas.task_schema import TaskSchema
from app.services.board_service import move_task_to_column
from app.services.column_service import (
    create_column,
    delete_column,
    list_columns,
    reorder_columns,
    update_column,
)
from app.services.task_service import get_task


def _project_id() -> fields.Integer:
    return fields.Integer(required=True, validate=validate.Range(min=1))


class ProjectColumnsSchema(CamelSchema):
    project_id = _project_id()


class NewColumnSchema(ColumnSchema):
    project_id = _project_id()


class ColumnOrderInputSchema(ColumnOrderSchema):
    project_id = _project_id()


def _list_columns(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    columns = list_columns(user_id, data["project_id"])
    return {"columns": ColumnSchema(many=True).dump(columns)}


def _create_column(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_id = data.pop("project_id")
    return ColumnSchema().dump(create_column(user_id, project_id, data))


def _update_column(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    column_id = data.pop("id")
    return ColumnSchema().dump(update_column(user_id, column_id, data))


def _reorder_columns(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    columns = reorder_columns(user_id, data["project_id"], data["column_ids"])
    return {"columns": ColumnSchema(many=True).dump(columns)}


def _delete_column(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    delete_column(user_id, data["id"], data["move_to_id"])
    return {"id": data["id"], "message": "Deleted"}


def _move_task_to_column(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    task_id = data["id"]
    task = move_task_to_column(
        user_id,
        task_id,
        data["column_id"],
        data.get("after_id"),
        data.get("before_id"),
    )
    if task.is_deleted:
        return {"id": task_id, "deleted": True}
    return TaskSchema().dump(get_task(user_id, task_id))


COLUMN_TOOLS = (
    Tool(
        name="list_columns",
        title="List a project's columns",
        description=(
            "List the kanban columns of a project in board order. Every project "
            "starts with To Do, In Progress and Done. Inbox tasks have no project "
            "and so no columns. A task's column is its columnId."
        ),
        input=ProjectColumnsSchema,
        scope=TokenScope.READ,
        run=_list_columns,
    ),
    Tool(
        name="create_column",
        title="Create a column",
        description=(
            "Add a column at the end of a project's board. onDrop is what dropping "
            "a task on it does: nothing, complete, uncomplete or delete (moves the "
            "task to the trash). Names are unique within the project, ignoring case."
        ),
        input=NewColumnSchema,
        scope=TokenScope.WRITE,
        run=_create_column,
    ),
    Tool(
        name="update_column",
        title="Update a column",
        description=(
            "Rename, recolour or change the status or onDrop of a column. Only the "
            "fields given change. Use reorder_columns to change its position."
        ),
        input=ColumnUpdateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_update_column,
        idempotent=True,
    ),
    Tool(
        name="reorder_columns",
        title="Reorder a project's columns",
        description=(
            "Set the board order of a project's columns. columnIds must list every "
            "column of the project exactly once, first to last."
        ),
        input=ColumnOrderInputSchema,
        scope=TokenScope.WRITE,
        run=_reorder_columns,
        idempotent=True,
    ),
    Tool(
        name="delete_column",
        title="Delete a column",
        description=(
            "Permanently delete a column. Its tasks are kept and moved to the column "
            "moveToId (in the same project), or left unassigned when moveToId is "
            "null. This cannot be undone. Confirm with the user before calling."
        ),
        input=ColumnDeleteSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_delete_column,
        destructive=True,
    ),
    Tool(
        name="move_task_to_column",
        title="Move a task to a column",
        description=(
            "Move a task (id) to a column of its project, or to Unassigned with "
            "columnId null. afterId or beforeId place it next to another task in "
            "that column. The column's onDrop also runs: complete marks the task "
            "done, uncomplete reopens it, and delete moves it to the trash, in "
            "which case the result is {id, deleted: true}. Inbox tasks and "
            "subtasks cannot be moved."
        ),
        input=BoardMoveSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_move_task_to_column,
    ),
)
