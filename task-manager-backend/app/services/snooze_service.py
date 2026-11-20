from datetime import date
from typing import Any

from app.database import db
from app.exceptions import SnoozeNotRepeating
from app.models import Task
from app.services.label_service import attach_label_ids
from app.services.reminder_service import attach_reminders, sync_reminders
from app.services.subtask_service import attach_subtask_counts
from app.services.task_service import apply_reschedule, get_task
from app.utils.snooze import snooze_today, snoozed_span, target_day
from app.utils.task_utils import next_task_start


def _move_to_next_occurrence(task: Task) -> Task:
    if not (task.is_repeating and task.repeat_by) or task.is_completed:
        raise SnoozeNotRepeating()
    next_start = next_task_start(task)
    task.end_at = next_start + (task.end_at - task.start_at)
    task.start_at = next_start
    sync_reminders(task)
    return task


def _move_repeating(task: Task, day: date, data: dict[str, Any]) -> Task:
    length = task.end_at - task.start_at
    source = data["previous_start_at"] if data["is_ghost"] else task.start_at
    start, end = snoozed_span(source, source + length, day, data["zone_name"])
    return apply_reschedule(
        task.user_id,
        task.id,
        {
            "previous_start_at": source,
            "start_at": start,
            "end_at": end,
            "is_ghost": data["is_ghost"],
        },
    )


def apply_snooze(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = get_task(user_id, task_id, lock=True)
    if data["preset"] == "next_occurrence":
        return _move_to_next_occurrence(task)

    today = snooze_today(data["zone_name"])
    day = target_day(data["preset"], today, data.get("day"))
    if task.is_repeating and task.repeat_by:
        return _move_repeating(task, day, data)
    task.start_at, task.end_at = snoozed_span(
        task.start_at, task.end_at, day, data["zone_name"]
    )
    sync_reminders(task)
    return task


def snooze_task(user_id: int, task_id: int, data: dict[str, Any]) -> Task:
    task = apply_snooze(user_id, task_id, data)
    db.session.commit()
    attach_label_ids([task])
    attach_reminders([task])
    attach_subtask_counts([task])
    return task
