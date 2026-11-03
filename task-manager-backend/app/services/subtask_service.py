from collections.abc import Iterable
from typing import Any

from sqlalchemy import case, func, select, update

from app.database import db
from app.exceptions import SubtaskParentInvalid, TaskNotFound
from app.models import Task
from app.utils.dates import utc_now
from app.utils.task_utils import live_tasks_of


def _counts_owner_id(task: Task) -> int:
    return task.series_id if getattr(task, "is_ghost", False) else task.id  # type: ignore


def attach_subtask_counts(tasks: Iterable[Task]) -> None:
    """Sets the subtask counts on each task with one query; ghosts use their series."""
    tasks = list(tasks)
    owners = {_counts_owner_id(task) for task in tasks}
    rows = db.session.execute(
        select(
            Task.parent_id,
            func.count(),
            func.coalesce(func.sum(case((Task.is_completed, 1), else_=0)), 0),
        )
        .where(Task.parent_id.in_(owners), Task.is_deleted.is_(False))
        .group_by(Task.parent_id)
    )
    counts = {parent_id: (total, int(done)) for parent_id, total, done in rows}
    for task in tasks:
        total, done = counts.get(_counts_owner_id(task), (0, 0))
        task.subtask_count = total  # type: ignore
        task.subtask_completed_count = done  # type: ignore


def attach_subtasks(task: Task) -> None:
    stmt = (
        select(Task)
        .where(Task.parent_id == task.id, Task.is_deleted.is_(False))
        .order_by(Task.position, Task.id)
    )
    task.subtasks = list(db.session.scalars(stmt))  # type: ignore


def _top_level_parent(user_id: int, parent_id: int) -> Task:
    parent = db.session.scalar(
        select(Task)
        .where(live_tasks_of(user_id), Task.id == parent_id)
        .with_for_update()
    )
    if parent is None:
        raise TaskNotFound(parent_id)
    if parent.parent_id is not None:
        raise SubtaskParentInvalid()
    return parent


def add_subtasks(
    user_id: int, parent_id: int, items: list[dict[str, Any]]
) -> list[Task]:
    parent = _top_level_parent(user_id, parent_id)
    last_position = db.session.scalar(
        select(func.max(Task.position)).where(Task.parent_id == parent.id)
    )
    first_position = 0 if last_position is None else last_position + 1
    subtasks = [
        Task(
            **item,
            user_id=user_id,
            parent_id=parent.id,
            project_id=parent.project_id,
            position=first_position + index,
        )
        for index, item in enumerate(items)
    ]
    db.session.add_all(subtasks)
    db.session.flush()
    for subtask in subtasks:
        subtask.series_id = subtask.id
    db.session.commit()
    return subtasks


def complete_open_subtasks(parent: Task) -> None:
    db.session.execute(
        update(Task)
        .where(Task.parent_id == parent.id, Task.is_completed.is_(False))
        .values(is_completed=True, completed_at=utc_now())
    )


def reset_subtasks(parent: Task) -> None:
    db.session.execute(
        update(Task)
        .where(Task.parent_id == parent.id)
        .values(is_completed=False, completed_at=None)
    )


def move_subtasks_to_project(parent: Task) -> None:
    db.session.execute(
        update(Task)
        .where(Task.parent_id == parent.id)
        .values(project_id=parent.project_id)
    )


def set_subtasks_deleted(parent: Task, deleted: bool) -> None:
    db.session.execute(
        update(Task)
        .where(Task.parent_id == parent.id)
        .values(is_deleted=deleted, deleted_at=parent.deleted_at)
    )
