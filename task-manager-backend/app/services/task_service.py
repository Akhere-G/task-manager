from dataclasses import replace
from datetime import date, datetime, timezone

from app.database import db
from app.models import Task
from app.services.task_query import TaskQuery
from app.utils.formatters import to_snake_case
from app.utils.serializers import task_to_dict
from app.utils.validators import MAX_TASKS_PER_REQUEST
from app.utils.task_utils import (
    build_task_filters,
    check_should_repeat,
    handle_repeat_task,
    with_repeating,
)
from dateutil import parser
from sqlalchemy import asc, desc, func, select


def get_all_tasks(user_id, query=TaskQuery()):
    clauses = build_task_filters(user_id, query)

    total_count = (
        db.session.execute(
            select(func.count()).select_from(Task).where(*clauses)
        ).scalar()
        or 0
    )

    sort_map = {
        "created_at": Task.created_at,
        "title": Task.title,
        "start_at": Task.start_at,
        "duration": func.timestampdiff(
            func.literal_column("MINUTE"), Task.start_at, Task.end_at
        ),
    }
    sort_field = sort_map.get(query.sort_by, Task.created_at)  # type: ignore
    order_expr = desc(sort_field) if query.order == "desc" else asc(sort_field)

    page = max(int(query.page or 1), 1)
    limit = query.limit
    if limit is None:
        limit = min(total_count, MAX_TASKS_PER_REQUEST)
    limit = max(int(limit), 1)
    offset = limit * (page - 1)

    stmt = (
        select(Task)
        .where(*clauses)
        .order_by(order_expr, Task.id)
        .limit(limit)
        .offset(offset)
    )
    tracked_tasks = db.session.execute(stmt).scalars().all()

    tasks = [task_to_dict(t) for t in tracked_tasks]

    if query.project_repeating:

        def parse_date(d):
            return parser.isoparse(d) if isinstance(d, str) else d

        start = parse_date(query.start_date)
        end = parse_date(query.end_date)

        base_clauses = build_task_filters(
            user_id, replace(query, start_date=None, end_date=None)
        )

        tasks = with_repeating(tasks, start, end, user_id, base_clauses)
        total_count = len(tasks)

    return {
        "tasks": tasks,
        "total_tasks": total_count,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
        "current_page": page,
    }


def get_task(user_id, task_id):
    task = db.session.execute(
        select(Task).where(Task.user_id == user_id, Task.id == task_id)
    ).scalar_one_or_none()

    if not task:
        return None

    return task_to_dict(task)


def create_task(user_id, data):
    new_task = Task(
        title=data.get("title", "").strip(),
        description=data.get("description").strip()
        if data.get("description")
        else None,
        category=str(data.get("category", "General")).strip(),
        start_at=data.get("startAt"),
        end_at=data.get("endAt"),
        is_repeating=bool(data.get("isRepeating")),
        repeat_by=data.get("repeatBy"),
        repeat_until=data.get("repeatUntil"),
        user_id=user_id,
    )
    db.session.add(new_task)
    db.session.flush()

    new_task.series_id = new_task.id
    db.session.commit()

    return new_task.id


def create_tasks_from_list(user_id, tasks):
    inserted_tasks = []
    for t in tasks:
        new_task = Task(
            title=t.get("title"),
            description=t.get("description").strip() if t.get("description") else None,
            category=t.get("category", "General"),
            start_at=t.get("startAt"),
            end_at=t.get("endAt"),
            user_id=user_id,
            is_completed=bool(t.get("isCompleted")),
            completed_at=t.get("completedAt"),
            is_repeating=bool(t.get("repeatBy")),
            repeat_by=t.get("repeatBy"),
            repeat_until=t.get("repeatUntil"),
            created_at=t.get("createdAt") or date.today(),
        )
        db.session.add(new_task)
        inserted_tasks.append(new_task)

    db.session.flush()

    for t in inserted_tasks:
        if t.series_id is None:
            t.series_id = t.id

    db.session.commit()
    return len(inserted_tasks)


class TaskValidationError(Exception):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field
        self.message = message


class TaskConflict(Exception):
    def __init__(self, task):
        super().__init__("The task has changed since it was loaded.")
        self.task = task


UPDATABLE_FIELDS = [
    "title",
    "description",
    "category",
    "start_at",
    "end_at",
    "is_completed",
    "completed_at",
    "is_repeating",
    "repeat_by",
    "repeat_until",
]


def _as_naive_utc(value):
    if isinstance(value, str):
        value = parser.isoparse(value)
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _task_state(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "is_completed": task.is_completed,
        "completed_at": task.completed_at,
        "start_at": task.start_at,
        "end_at": task.end_at,
        "is_repeating": task.is_repeating,
        "repeat_by": task.repeat_by,
        "repeat_until": task.repeat_until,
        "created_at": task.created_at,
    }


def update_task(user_id, task_id, data: dict):
    task = db.session.execute(
        select(Task)
        .where(Task.id == task_id, Task.user_id == user_id)
        .with_for_update()
    ).scalar_one_or_none()

    if not task:
        return None

    old_task_dict = _task_state(task)
    incoming = {to_snake_case(k): v for k, v in data.items()}

    start = _as_naive_utc(incoming.get("start_at") or task.start_at)
    end = _as_naive_utc(incoming.get("end_at") or task.end_at)
    if end <= start:
        raise TaskValidationError("endAt", "End time must be after the start time.")

    expected_start = incoming.get("expected_start_at")
    completing = bool(incoming.get("is_completed")) and not task.is_completed
    if (
        expected_start
        and completing
        and task.is_repeating
        and _as_naive_utc(expected_start) != task.start_at
    ):
        raise TaskConflict(old_task_dict)

    for key, v in incoming.items():
        if key in UPDATABLE_FIELDS:
            value = v.strip() if isinstance(v, str) else v
            value = bool(v) if key in ["is_completed", "is_repeating"] else value
            setattr(task, key, value)
    if task.is_completed and not old_task_dict["is_completed"]:
        task.completed_at = datetime.now(timezone.utc)

    elif not task.is_completed and old_task_dict["is_completed"]:
        task.completed_at = None
    db.session.flush()

    if check_should_repeat(old_task_dict, _task_state(task)):
        handle_repeat_task(user_id, old_task_dict)
        db.session.flush()

    result = _task_state(task)
    db.session.commit()
    return result


def delete_task(user_id, task_id):
    task = db.session.execute(
        select(Task).where(Task.user_id == user_id, Task.id == task_id)
    ).scalar_one_or_none()

    if task:
        db.session.delete(task)
        db.session.commit()
        return task_id
    return None
