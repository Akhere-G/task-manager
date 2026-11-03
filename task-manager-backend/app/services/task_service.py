from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, desc, func, select

from app.constants import TRASH_RETENTION_DAYS
from app.database import db
from app.exceptions import (
    IncompleteTaskDates,
    InvalidTaskTimes,
    SubtaskCannotRepeat,
    TaskConflict,
    TaskNotFound,
    UndatedRepeatingTask,
)
from app.models import Task
from app.schemas.task_schema import TaskSchema
from app.services.label_service import (
    attach_label_ids,
    ensure_labels_belong_to,
    set_task_labels,
)
from app.services.order_service import top_positions
from app.services.project_service import ensure_projects_belong_to
from app.services.reminder_service import (
    DEFAULT_REMINDER,
    attach_reminders,
    set_reminders,
    sync_reminders,
    wants_default_reminder,
)
from app.services.subtask_service import (
    attach_subtask_counts,
    attach_subtasks,
    complete_open_subtasks,
    move_subtasks_to_project,
    reset_subtasks,
    set_subtasks_deleted,
)
from app.utils.dates import get_zone, utc_now
from app.utils.recurrence import (
    at_time_of,
    default_days,
    normalise_days,
    replace_slot,
    snap_to_slot,
)
from app.utils.task_utils import (
    live_tasks_of,
    roll_series,
    should_roll_series,
    snapshot,
)

NON_COLUMN_FIELDS = {"expected_start_at", "label_ids", "reminders"}
TRASH_RETENTION = timedelta(days=TRASH_RETENTION_DAYS)
RECURRENCE_FIELDS = {
    "repeat_by",
    "repeat_interval",
    "repeat_days",
    "repeat_timezone",
    "start_at",
}


def get_task(user_id: int, task_id: int, lock: bool = False) -> Task:
    stmt = select(Task).where(live_tasks_of(user_id), Task.id == task_id)
    task = db.session.scalar(stmt.with_for_update() if lock else stmt)
    if task is None:
        raise TaskNotFound(task_id)
    if not lock:
        attach_label_ids([task])
        attach_reminders([task])
        attach_subtask_counts([task])
        attach_subtasks(task)
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


def _purge_expired_trash(user_id: int) -> None:
    expired_before = utc_now() - TRASH_RETENTION
    db.session.execute(
        delete(Task).where(
            Task.user_id == user_id,
            Task.is_deleted,
            Task.deleted_at < expired_before,
        )
    )


def create_tasks(user_id: int, items: list[dict[str, Any]]) -> list[Task]:
    ensure_projects_belong_to(user_id, (item.get("project_id") for item in items))
    label_ids = [item.pop("label_ids", []) for item in items]
    reminders = [item.pop("reminders", None) for item in items]
    for ids in label_ids:
        ensure_labels_belong_to(user_id, ids)
    for item in items:
        _check_dates(
            item.get("start_at"),
            item.get("end_at"),
            item.get("is_repeating") or item.get("repeat_by"),
        )
    _purge_expired_trash(user_id)
    positions = top_positions(user_id, len(items))
    tasks = [
        Task(**item, user_id=user_id, sort_order=position)
        for item, position in zip(items, positions, strict=True)
    ]
    for task in tasks:
        _apply_recurrence(task)
    db.session.add_all(tasks)
    db.session.flush()
    for task, ids, specs in zip(tasks, label_ids, reminders, strict=True):
        task.series_id = task.id
        set_task_labels([task.id], ids)
        if specs is None and wants_default_reminder(task):
            specs = [DEFAULT_REMINDER]
        set_reminders(task, specs or [])
    db.session.commit()
    attach_label_ids(tasks)
    attach_reminders(tasks)
    attach_subtask_counts(tasks)
    for task in tasks:
        task.subtasks = []  # type: ignore
    return tasks


def create_task(user_id: int, data: dict[str, Any]) -> Task:
    return create_tasks(user_id, [data])[0]


def _check_dates(
    start: datetime | None, end: datetime | None, is_repeating: bool | None
) -> None:
    if (start is None) != (end is None):
        raise IncompleteTaskDates()
    if start is None:
        if is_repeating:
            raise UndatedRepeatingTask()
        return
    if end <= start:  # type: ignore
        raise InvalidTaskTimes()


def _check_times(task: Task, data: dict[str, Any]) -> None:
    _check_dates(
        data.get("start_at", task.start_at),
        data.get("end_at", task.end_at),
        data.get("is_repeating", task.is_repeating) or data.get("repeat_by"),
    )


def _check_subtask_fields(data: dict[str, Any]) -> None:
    if data.get("is_repeating") or data.get("repeat_by"):
        raise SubtaskCannotRepeat()
    data.pop("project_id", None)


def _check_not_already_completed(task: Task, data: dict[str, Any]) -> None:
    expected_start = data.get("expected_start_at")
    completing = data.get("is_completed") and not task.is_completed
    if (
        expected_start
        and completing
        and task.is_repeating
        and expected_start != task.start_at
    ):
        raise TaskConflict(TaskSchema().dump(task))  # type: ignore


def _sync_completion(task: Task, was_completed: bool) -> None:
    if task.is_completed and not was_completed:
        task.completed_at = utc_now()
    elif not task.is_completed and was_completed:
        task.completed_at = None


def update_task(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = get_task(user_id, task_id, lock=True)
    before = snapshot(task)

    ensure_projects_belong_to(user_id, [data.get("project_id")])
    if "label_ids" in data:
        ensure_labels_belong_to(user_id, data["label_ids"])
        set_task_labels([task.id], data["label_ids"])
    _check_times(task, data)
    _check_not_already_completed(task, data)
    new_reminders = data.get("reminders")
    if task.parent_id is not None:
        _check_subtask_fields(data)

    for field, value in data.items():
        if field not in NON_COLUMN_FIELDS:
            setattr(task, field, value)
    _sync_completion(task, before.is_completed)

    if "repeat_by" in data and "repeat_days" not in data:
        task.repeat_days = None
    if RECURRENCE_FIELDS & data.keys() or not task.is_repeating:
        _apply_recurrence(task)

    db.session.flush()
    if new_reminders is not None:
        set_reminders(task, new_reminders)
    else:
        sync_reminders(task)

    if "project_id" in data and task.parent_id is None:
        move_subtasks_to_project(task)

    rolled = should_roll_series(task, before)
    if rolled:
        roll_series(task, before)
        reset_subtasks(task)
        db.session.flush()
    elif task.is_completed and not before.is_completed:
        complete_open_subtasks(task)

    db.session.commit()
    attach_label_ids([task])
    attach_reminders([task])
    attach_subtask_counts([task])
    return task


def reschedule_task(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = get_task(user_id, task_id, lock=True)
    previous_start = data["previous_start_at"]
    new_start = data["start_at"]
    new_end = data["end_at"]
    duration = new_end - new_start

    if not data["is_ghost"] and previous_start != task.start_at:
        raise TaskConflict(TaskSchema().dump(task))  # type: ignore

    if not task.is_repeating or not task.repeat_by:
        task.start_at = new_start
        task.end_at = new_end
    elif not task.repeat_days:
        task.start_at = task.start_at + (new_start - previous_start)
        task.end_at = task.start_at + duration
    else:
        zone = get_zone(task.repeat_timezone)
        task.repeat_days = replace_slot(
            task.repeat_by, task.repeat_days, previous_start, new_start, zone
        )
        if data["is_ghost"]:
            task.start_at = at_time_of(task.start_at, new_start, zone)
        else:
            task.start_at = new_start
        task.end_at = task.start_at + duration
        _apply_recurrence(task)

    sync_reminders(task)
    db.session.commit()
    attach_label_ids([task])
    attach_reminders([task])
    attach_subtask_counts([task])
    return task


def delete_task(user_id: int, task_id: int) -> None:
    task = get_task(user_id, task_id)
    if task.parent_id is not None:
        db.session.delete(task)
    else:
        task.is_deleted = True
        task.deleted_at = utc_now()
        set_subtasks_deleted(task, True)
    db.session.commit()


def get_trash(user_id: int, page: int, limit: int) -> dict[str, Any]:
    clauses = (Task.user_id == user_id, Task.is_deleted, Task.parent_id.is_(None))
    total = (
        db.session.scalar(select(func.count()).select_from(Task).where(*clauses)) or 0
    )
    stmt = (
        select(Task)
        .where(*clauses)
        .order_by(desc(Task.deleted_at), desc(Task.id))
        .limit(limit)
        .offset(limit * (page - 1))
    )
    tasks = list(db.session.scalars(stmt))
    attach_label_ids(tasks)
    return {
        "tasks": tasks,
        "total_tasks": total,
        "total_pages": (total + limit - 1) // limit,
        "current_page": page,
    }


def restore_task(user_id: int, task_id: int) -> Task:
    task = db.session.scalar(
        select(Task).where(Task.user_id == user_id, Task.id == task_id, Task.is_deleted)
    )
    if task is None:
        raise TaskNotFound(task_id)
    task.is_deleted = False
    task.deleted_at = None
    set_subtasks_deleted(task, False)
    db.session.commit()
    attach_label_ids([task])
    attach_reminders([task])
    return task
