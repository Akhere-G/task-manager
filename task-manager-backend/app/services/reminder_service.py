from collections.abc import Iterable
from typing import Any

from sqlalchemy import delete, select

from app.database import db
from app.models import Task, TaskReminder
from app.utils.reminders import DEFAULT_MINUTES_BEFORE, fire_time

DEFAULT_REMINDER: dict[str, Any] = {
    "kind": "before",
    "minutes_before": DEFAULT_MINUTES_BEFORE,
}
SPEC_FIELDS = ("kind", "minutes_before", "days_before", "time_of_day", "zone_name")


def _fire_at(task: Task, reminder: TaskReminder):
    if task.start_at is None:
        return None
    return fire_time(
        task.start_at,
        reminder.kind,
        reminder.minutes_before,
        reminder.days_before,
        reminder.time_of_day,
        reminder.zone_name,
    )


def _owner_id(task: Task) -> int:
    return task.series_id if getattr(task, "is_ghost", False) else task.id  # type: ignore


def set_reminders(task: Task, specs: Iterable[dict[str, Any]]) -> None:
    """Replaces the task's reminders; `task.id` must exist."""
    db.session.execute(delete(TaskReminder).where(TaskReminder.task_id == task.id))
    for spec in specs:
        reminder = TaskReminder(task_id=task.id, **spec)
        reminder.fire_at = _fire_at(task, reminder)
        db.session.add(reminder)


def wants_default_reminder(task: Task) -> bool:
    return task.start_at is not None and task.parent_id is None


def sync_reminders(task: Task) -> None:
    """Recomputes fire times after the task's start moved."""
    for reminder in db.session.scalars(
        select(TaskReminder).where(TaskReminder.task_id == task.id)
    ):
        reminder.fire_at = _fire_at(task, reminder)


def attach_reminders(tasks: Iterable[Task]) -> None:
    """Sets `reminders` on each task with one query; ghosts use their series'."""
    tasks = list(tasks)
    owners = {_owner_id(task) for task in tasks}
    rows = db.session.scalars(
        select(TaskReminder)
        .where(TaskReminder.task_id.in_(owners))
        .order_by(TaskReminder.id)
    )
    by_task: dict[int, list[TaskReminder]] = {}
    for reminder in rows:
        by_task.setdefault(reminder.task_id, []).append(reminder)
    for task in tasks:
        task.reminders = by_task.get(_owner_id(task), [])  # type: ignore
