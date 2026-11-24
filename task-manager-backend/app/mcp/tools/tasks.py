from typing import Any

from app.mcp.registry import Tool
from app.mcp.schemas import EmptySchema
from app.models import TokenScope
from app.schemas.task_schema import (
    TaskListQuerySchema,
    TaskPageSchema,
    TaskSchema,
    TaskUpdateSchema,
    TrashedTaskSchema,
    TrashPageSchema,
    TrashQuerySchema,
)
from app.services.task_listing import get_all_tasks
from app.services.task_query import TaskQuery
from app.services.task_service import (
    create_task,
    delete_task,
    get_task,
    get_trash,
    is_in_trash,
    restore_task,
    update_task,
)

LIST_TASKS_DESCRIPTION = (
    "List the user's tasks, newest page first. Filters: project and column are ids; "
    "label is comma-separated label ids; priority is comma-separated values from 1 "
    "(urgent) to 4; q searches titles and descriptions; group is one of overdue, "
    "today, upcoming, undated or completed and needs zone, an IANA time zone name "
    "such as Europe/London; is_completed is true or false; start_date and end_date "
    "are ISO 8601 and must be given together. Use page and limit to page through."
)


def _list_tasks(user_id: int, query: TaskQuery) -> dict[str, Any]:
    return TaskPageSchema().dump(get_all_tasks(user_id, query))


def _get_task(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return TaskSchema().dump(get_task(user_id, data["id"]))


def _list_trash(user_id: int, query: dict[str, Any]) -> dict[str, Any]:
    return TrashPageSchema().dump(get_trash(user_id, **query))


def _create_task(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return TaskSchema().dump(create_task(user_id, data))


def _update_task(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    task_id = data.pop("id")
    return TaskSchema().dump(update_task(user_id, task_id, data))


def _delete_task(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    already_in_trash = is_in_trash(user_id, data["id"])
    delete_task(user_id, data["id"])
    message = "Already in the trash" if already_in_trash else "Deleted"
    return {"id": data["id"], "message": message}


def _restore_task(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    was_in_trash = is_in_trash(user_id, data["id"])
    task = restore_task(user_id, data["id"])
    message = "Restored" if was_in_trash else "Was not in the trash"
    return {**TrashedTaskSchema().dump(task), "message": message}


TASK_TOOLS = (
    Tool(
        name="list_tasks",
        title="List tasks",
        description=LIST_TASKS_DESCRIPTION,
        input=TaskListQuerySchema,
        scope=TokenScope.READ,
        run=_list_tasks,
    ),
    Tool(
        name="get_task",
        title="Get a task",
        description=(
            "Get one task by id, with its labels, reminders and subtasks. Each "
            "subtask carries its own id, which update_task and delete_task accept."
        ),
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.READ,
        run=_get_task,
    ),
    Tool(
        name="list_trash",
        title="List trashed tasks",
        description="List deleted tasks that can still be restored, with purgeAt.",
        input=TrashQuerySchema,
        scope=TokenScope.READ,
        run=_list_trash,
    ),
    Tool(
        name="create_task",
        title="Create a task",
        description=(
            "Create a task. Set projectId or projectName (created if missing, "
            "nesting with ' / ') and labelIds or labelNames (created if missing). "
            "Without a project it goes to the inbox. startAt and endAt go together."
        ),
        input=TaskSchema,
        scope=TokenScope.WRITE,
        run=_create_task,
    ),
    Tool(
        name="update_task",
        title="Update a task",
        description=(
            "Change only the fields given on a task. Set isCompleted to complete or "
            "reopen it; set projectId to move it."
        ),
        input=TaskUpdateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_update_task,
    ),
    Tool(
        name="delete_task",
        title="Delete a task",
        description=(
            "Move a task and its subtasks to the trash. It can be brought back with "
            "restore_task for 30 days before it is purged. A subtask (a task with a "
            "parentId) is deleted permanently instead."
        ),
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_delete_task,
        idempotent=True,
    ),
    Tool(
        name="restore_task",
        title="Restore a task",
        description="Take a task out of the trash.",
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_restore_task,
        idempotent=True,
    ),
)
