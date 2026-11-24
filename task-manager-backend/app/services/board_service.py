from app.database import db
from app.exceptions import InvalidColumn, TaskNotFound
from app.models import OnDrop, Task
from app.services.column_service import get_column
from app.services.order_service import place_task
from app.services.task_service import (
    apply_task_trash,
    apply_task_update,
    get_task,
)

COMPLETION_BY_ON_DROP = {OnDrop.COMPLETE: True, OnDrop.UNCOMPLETE: False}


def apply_move_to_column(
    user_id: int,
    task_id: int,
    column_id: int | None,
    after_id: int | None,
    before_id: int | None,
) -> Task:
    """Drops the task into a column, then runs the column's on_drop action."""
    column = None if column_id is None else get_column(user_id, column_id)
    task = get_task(user_id, task_id, lock=True)
    if task.parent_id is not None:
        raise TaskNotFound(task_id)
    if column is not None and task.project_id != column.project_id:
        raise InvalidColumn()

    previous_column_id = task.column_id
    task.column_id = column_id
    if after_id is not None or before_id is not None:
        place_task(user_id, task, after_id, before_id)

    on_drop = OnDrop.NOTHING if column is None else column.on_drop
    if on_drop == OnDrop.DELETE:
        apply_task_trash(user_id, task_id)
    elif on_drop in COMPLETION_BY_ON_DROP:
        is_completed = COMPLETION_BY_ON_DROP[on_drop]
        if task.is_completed != is_completed:
            apply_task_update(user_id, task_id, {"is_completed": is_completed})
            if is_completed and not task.is_completed:
                task.column_id = previous_column_id
    return task


def move_task_to_column(
    user_id: int,
    task_id: int,
    column_id: int | None,
    after_id: int | None,
    before_id: int | None,
) -> Task:
    task = apply_move_to_column(user_id, task_id, column_id, after_id, before_id)
    db.session.commit()
    return task
