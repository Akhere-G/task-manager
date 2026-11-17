from collections.abc import Callable
from typing import Any

from sqlalchemy import select

from app.database import db
from app.exceptions import AppError
from app.models import Task
from app.services.board_service import move_task_to_column
from app.services.snooze_service import snooze_task
from app.services.task_service import delete_task, update_task
from app.utils.task_utils import live_tasks_of

TaskAction = Callable[[int, int], object]


def _apply_each(user_id: int, task_ids: list[int], action: TaskAction) -> int:
    updated = 0
    for task_id in task_ids:
        try:
            action(user_id, task_id)
        except AppError:
            db.session.rollback()
            continue
        updated += 1
    return updated


def _dated_task_ids(user_id: int, task_ids: list[int]) -> list[int]:
    stmt = select(Task.id).where(
        live_tasks_of(user_id),
        Task.id.in_(task_ids),
        Task.start_at.is_not(None),
        Task.end_at.is_not(None),
    )
    dated = set(db.session.scalars(stmt))
    return [task_id for task_id in task_ids if task_id in dated]


def complete_tasks(user_id: int, task_ids: list[int]) -> int:
    return _apply_each(
        user_id,
        task_ids,
        lambda user, task_id: update_task(user, task_id, {"is_completed": True}),
    )


def snooze_tasks(user_id: int, task_ids: list[int], data: dict[str, Any]) -> int:
    return _apply_each(
        user_id,
        _dated_task_ids(user_id, task_ids),
        lambda user, task_id: snooze_task(user, task_id, data),
    )


def delete_tasks(user_id: int, task_ids: list[int]) -> int:
    return _apply_each(user_id, task_ids, delete_task)


def set_priority(user_id: int, task_ids: list[int], priority: int) -> int:
    return _apply_each(
        user_id,
        task_ids,
        lambda user, task_id: update_task(user, task_id, {"priority": priority}),
    )


def move_tasks_to_column(
    user_id: int, task_ids: list[int], column_id: int | None
) -> int:
    return _apply_each(
        user_id,
        task_ids,
        lambda user, task_id: move_task_to_column(user, task_id, column_id, None, None),
    )
