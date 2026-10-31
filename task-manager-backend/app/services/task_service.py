from dataclasses import replace
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, func, select

from app.constants import MAX_TASKS_PER_REQUEST
from app.database import db
from app.exceptions import InvalidTaskTimes, TaskConflict, TaskNotFound
from app.models import Task
from app.schemas.task_schema import TaskSchema
from app.services.task_query import TaskQuery
from app.utils.dates import get_zone, parse_iso, utc_now
from app.utils.recurrence import (
    at_time_of,
    default_days,
    normalise_days,
    replace_slot,
    snap_to_slot,
)
from app.utils.task_utils import (
    build_task_clauses,
    next_task_start,
    roll_series,
    should_roll_series,
    snapshot,
    with_repeating,
)

NON_COLUMN_FIELDS = {"expected_start_at", "skip_occurrence"}
RECURRENCE_FIELDS = {
    "repeat_by",
    "repeat_interval",
    "repeat_days",
    "repeat_timezone",
    "start_at",
}


def _sort_clause(query: TaskQuery) -> UnaryExpression[Any]:
    duration = func.timestampdiff(
        func.literal_column("MINUTE"), Task.start_at, Task.end_at
    )
    columns = {
        "created_at": Task.created_at,
        "title": Task.title,
        "start_at": Task.start_at,
        "duration": duration,
    }
    column = columns.get(query.sort_by, Task.created_at)  # type: ignore
    return desc(column) if query.order == "desc" else asc(column)


def _page_size(query: TaskQuery, total: int) -> int:
    return max(query.limit or min(total, MAX_TASKS_PER_REQUEST), 1)


def _project_repeating(user_id: int, query: TaskQuery, tasks: list[Task]) -> list[Task]:
    unranged = replace(query, start_date=None, end_date=None)
    return with_repeating(
        tasks,
        parse_iso(query.start_date),
        parse_iso(query.end_date),
        user_id,
        build_task_clauses(user_id, unranged),
    )


def get_all_tasks(user_id: int, query: TaskQuery = TaskQuery()) -> dict[str, Any]:
    clauses = build_task_clauses(user_id, query)
    total = (
        db.session.scalar(select(func.count()).select_from(Task).where(*clauses)) or 0
    )
    limit = _page_size(query, total)
    page = max(query.page or 1, 1)

    stmt = (
        select(Task)
        .where(*clauses)
        .order_by(_sort_clause(query), Task.id)
        .limit(limit)
        .offset(limit * (page - 1))
    )
    tasks = list(db.session.scalars(stmt))

    if query.project_repeating:
        tasks = _project_repeating(user_id, query, tasks)
        total = len(tasks)

    return {
        "tasks": tasks,
        "total_tasks": total,
        "total_pages": (total + limit - 1) // limit,
        "current_page": page,
    }


def get_task(user_id: int, task_id: int, lock: bool = False) -> Task:
    stmt = select(Task).where(Task.user_id == user_id, Task.id == task_id)
    task = db.session.scalar(stmt.with_for_update() if lock else stmt)
    if task is None:
        raise TaskNotFound(task_id)
    return task


def _apply_recurrence(task: Task) -> None:
    if not task.is_repeating or not task.repeat_by:
        task.repeat_interval = 1
        task.repeat_days = None
        task.repeat_timezone = None
        return

    zone = get_zone(task.repeat_timezone)
    task.repeat_interval = task.repeat_interval or 1
    if task.repeat_by == "daily":
        task.repeat_days = None
    else:
        task.repeat_days = normalise_days(
            task.repeat_by, task.repeat_days
        ) or default_days(task.start_at, task.repeat_by, zone)

    snapped = snap_to_slot(
        task.start_at, task.repeat_by, task.repeat_interval, task.repeat_days, zone
    )
    if snapped != task.start_at:
        task.end_at += snapped - task.start_at
        task.start_at = snapped


def create_tasks(user_id: int, items: list[dict[str, Any]]) -> list[Task]:
    tasks = [Task(**item, user_id=user_id) for item in items]
    for task in tasks:
        _apply_recurrence(task)
    db.session.add_all(tasks)
    db.session.flush()
    for task in tasks:
        task.series_id = task.id
    db.session.commit()
    return tasks


def create_task(user_id: int, data: dict[str, Any]) -> Task:
    return create_tasks(user_id, [data])[0]


def _check_times(task: Task, data: dict[str, Any]) -> None:
    start = data.get("start_at", task.start_at)
    end = data.get("end_at", task.end_at)
    if end <= start:
        raise InvalidTaskTimes()


def _check_not_already_completed(task: Task, data: dict[str, Any]) -> None:
    expected_start = data.get("expected_start_at")
    completing = data.get("is_completed") and not task.is_completed
    if (
        expected_start
        and completing
        and task.is_repeating
        and expected_start != task.start_at
    ):
        raise TaskConflict(TaskSchema().dump(task))


def _sync_completion(task: Task, was_completed: bool) -> None:
    if task.is_completed and not was_completed:
        task.completed_at = utc_now()
    elif not task.is_completed and was_completed:
        task.completed_at = None


def _skip_occurrence(task: Task) -> None:
    next_start = next_task_start(task)
    task.end_at = next_start + (task.end_at - task.start_at)
    task.start_at = next_start


def update_task(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = get_task(user_id, task_id, lock=True)
    before = snapshot(task)

    _check_times(task, data)
    _check_not_already_completed(task, data)

    for field, value in data.items():
        if field not in NON_COLUMN_FIELDS:
            setattr(task, field, value)
    _sync_completion(task, before.is_completed)

    if "repeat_by" in data and "repeat_days" not in data:
        task.repeat_days = None
    if RECURRENCE_FIELDS & data.keys() or not task.is_repeating:
        _apply_recurrence(task)

    if (
        data.get("skip_occurrence")
        and task.is_repeating
        and task.repeat_by
        and not task.is_completed
    ):
        _skip_occurrence(task)
    db.session.flush()

    if should_roll_series(task, before):
        roll_series(task, before)
        db.session.flush()

    db.session.commit()
    return task


def reschedule_task(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = get_task(user_id, task_id, lock=True)
    old_start = data["previous_start_at"]
    new_start = data["start_at"]
    new_end = data["end_at"]
    duration = new_end - new_start

    if not data["is_ghost"] and old_start != task.start_at:
        raise TaskConflict(TaskSchema().dump(task))

    if not task.is_repeating or not task.repeat_by:
        task.start_at = new_start
        task.end_at = new_end
    elif not task.repeat_days:
        task.start_at = task.start_at + (new_start - old_start)
        task.end_at = task.start_at + duration
    else:
        zone = get_zone(task.repeat_timezone)
        task.repeat_days = replace_slot(
            task.repeat_by, task.repeat_days, old_start, new_start, zone
        )
        if data["is_ghost"]:
            task.start_at = at_time_of(task.start_at, new_start, zone)
        else:
            task.start_at = new_start
        task.end_at = task.start_at + duration
        _apply_recurrence(task)

    db.session.commit()
    return task


def delete_task(user_id: int, task_id: int) -> None:
    db.session.delete(get_task(user_id, task_id))
    db.session.commit()
