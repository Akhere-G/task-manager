from collections.abc import Callable
from typing import Any

from sqlalchemy import select

from app.database import db
from app.exceptions import AppError
from app.models import Task
from app.services.board_service import apply_move_to_column
from app.services.snooze_service import apply_snooze
from app.services.task_service import apply_task_trash, apply_task_update
from app.utils.task_utils import live_tasks_of

TaskAction = Callable[[int, int], object]


def _apply_each(user_id: int, task_ids: list[int], action: TaskAction) -> int:
    updated = 0
    try:
        for task_id in task_ids:
            try:
                with db.session.begin_nested():
                    action(user_id, task_id)
            except AppError:
                continue
            updated += 1
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
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
        lambda user, task_id: apply_task_update(user, task_id, {"is_completed": True}),
    )


def snooze_tasks(user_id: int, task_ids: list[int], data: dict[str, Any]) -> int:
    return _apply_each(
        user_id,
        _dated_task_ids(user_id, task_ids),
        lambda user, task_id: apply_snooze(user, task_id, data),
    )


def delete_tasks(user_id: int, task_ids: list[int]) -> int:
    return _apply_each(user_id, task_ids, apply_task_trash)


def set_priority(user_id: int, task_ids: list[int], priority: int) -> int:
    return _apply_each(
        user_id,
        task_ids,
        lambda user, task_id: apply_task_update(user, task_id, {"priority": priority}),
    )


def move_tasks_to_column(
    user_id: int, task_ids: list[int], column_id: int | None
) -> int:
    return _apply_each(
        user_id,
        task_ids,
        lambda user, task_id: apply_move_to_column(
            user, task_id, column_id, None, None
        ),
    )
