from app.database import db
from app.exceptions import InvalidColumn, TaskNotFound
from app.models import OnDrop, Task
from app.services.column_service import get_column
from app.services.order_service import place_task
from app.services.task_service import delete_task, get_task, update_task

COMPLETION_BY_ON_DROP = {OnDrop.COMPLETE: True, OnDrop.UNCOMPLETE: False}


def move_task_to_column(
    user_id: int,
    task_id: int,
    column_id: int,
    after_id: int | None,
    before_id: int | None,
) -> Task:
    """Drops the task into a column, then runs the column's on_drop action."""
    column = get_column(user_id, column_id)
    task = get_task(user_id, task_id, lock=True)
    if task.parent_id is not None:
        raise TaskNotFound(task_id)
    if task.project_id != column.project_id:
        raise InvalidColumn()

    task.column_id = column.id
    if after_id is not None or before_id is not None:
        place_task(user_id, task, after_id, before_id)

    if column.on_drop == OnDrop.DELETE:
        delete_task(user_id, task_id)
    elif column.on_drop in COMPLETION_BY_ON_DROP:
        is_completed = COMPLETION_BY_ON_DROP[column.on_drop]
        if task.is_completed != is_completed:
            return update_task(user_id, task_id, {"is_completed": is_completed})
    db.session.commit()
    return task
