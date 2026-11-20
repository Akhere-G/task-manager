from typing import Any

from app.mcp.registry import Tool
from app.models import TokenScope
from app.schemas.task_schema import (
    SubtaskOrderSchema,
    SubtaskSchema,
    SubtasksCreateSchema,
)
from app.services.subtask_service import (
    add_subtasks,
    reorder_subtasks,
    replace_subtasks,
)


def _subtasks_result(subtasks: list[Any]) -> dict[str, Any]:
    return {"subtasks": SubtaskSchema(many=True).dump(subtasks)}


def _add_subtasks(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return _subtasks_result(add_subtasks(user_id, data["id"], data["subtasks"]))


def _replace_subtasks(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return _subtasks_result(replace_subtasks(user_id, data["id"], data["subtasks"]))


def _reorder_subtasks(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return _subtasks_result(reorder_subtasks(user_id, data["id"], data["ids"]))


SUBTASK_TOOLS = (
    Tool(
        name="add_subtasks",
        title="Add subtasks",
        description=(
            "Add subtasks to the end of a task's checklist; id is the parent task. "
            "A subtask has a title, description and priority. It cannot be nested "
            "or repeat. Edit or complete one with update_task using its own id, "
            "found in get_task."
        ),
        input=SubtasksCreateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_add_subtasks,
    ),
    Tool(
        name="replace_subtasks",
        title="Replace all subtasks",
        description=(
            "Permanently delete every subtask of a task (completed ones too) and "
            "add the given list instead; id is the parent task. This cannot be "
            "undone. Prefer add_subtasks unless the user wants the checklist "
            "rewritten, and confirm before calling."
        ),
        input=SubtasksCreateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_replace_subtasks,
        destructive=True,
    ),
    Tool(
        name="reorder_subtasks",
        title="Reorder subtasks",
        description=(
            "Set the order of a task's subtasks; id is the parent task. ids must "
            "list every subtask of the task exactly once, first to last."
        ),
        input=SubtaskOrderSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_reorder_subtasks,
        idempotent=True,
    ),
)
