from sqlalchemy import func, select, update

from app.constants import SORT_ORDER_GAP
from app.database import db
from app.exceptions import InvalidMove, TaskNotFound
from app.models import Task
from app.utils.ordering import position_between, spread
from app.utils.task_utils import live_tasks_of, top_level_tasks_of


def top_positions(user_id: int, count: int) -> list[int]:
    """Positions that put `count` new tasks above the user's existing ones, in order."""
    lowest = db.session.scalar(
        select(func.min(Task.sort_order)).where(Task.user_id == user_id)
    )
    base = 0 if lowest is None else min(lowest, 0)
    return [base - SORT_ORDER_GAP * (count - index) for index in range(count)]


def _lock_task(user_id: int, task_id: int) -> Task:
    task = db.session.scalar(
        select(Task)
        .where(live_tasks_of(user_id), Task.parent_id.is_(None), Task.id == task_id)
        .with_for_update()
    )
    if task is None:
        raise TaskNotFound(task_id)
    return task


def _position_of(user_id: int, task_id: int | None) -> int | None:
    return None if task_id is None else _lock_task(user_id, task_id).sort_order


def _renumber(user_id: int) -> None:
    ids = db.session.scalars(
        select(Task.id)
        .where(top_level_tasks_of(user_id))
        .order_by(Task.sort_order, Task.id)
    ).all()
    rows = [
        {"id": task_id, "sort_order": position}
        for task_id, position in zip(ids, spread(len(ids)), strict=True)
    ]
    db.session.execute(update(Task), rows)


def move_task(
    user_id: int, task_id: int, after_id: int | None, before_id: int | None
) -> None:
    """Puts the task after `after_id` and before `before_id`; None is an edge."""
    if after_id is None and before_id is None:
        raise InvalidMove()
    task = _lock_task(user_id, task_id)
    position = position_between(
        _position_of(user_id, after_id), _position_of(user_id, before_id)
    )
    if position is None:
        _renumber(user_id)
        db.session.refresh(task)
        position = position_between(
            _position_of(user_id, after_id), _position_of(user_id, before_id)
        )
    task.sort_order = position  # type: ignore
    db.session.commit()
