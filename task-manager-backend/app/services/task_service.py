from datetime import date
from sqlalchemy import select, func, desc, asc
from app.database import db
from app.models import Task
from app.utils.task_utils import (
    build_task_filters,
    with_repeating,
    check_should_repeat,
    handle_repeat_task,
)
from dateutil import parser
from app.utils.formatters import to_snake_case


def get_all_tasks(
    user_id,
    category=None,
    search=None,
    duration=None,
    is_completed=None,
    start_date=None,
    end_date=None,
    sort_by=None,
    order=None,
    limit=None,
    page=None,
    project_repeating=False,
):
    clauses = build_task_filters(
        user_id, category, search, is_completed, start_date, end_date, duration
    )

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
    sort_field = sort_map.get(sort_by, Task.created_at)  # type: ignore
    order_expr = desc(sort_field) if order == "desc" else asc(sort_field)

    page = max(int(page or 1), 1)
    limit = max(int(limit) if limit is not None else total_count, 1)
    offset = limit * (page - 1)

    stmt = select(Task).where(*clauses).order_by(order_expr).limit(limit).offset(offset)
    tracked_tasks = db.session.execute(stmt).scalars().all()

    tasks = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "category": t.category,
            "is_completed": t.is_completed,
            "start_at": t.start_at,
            "end_at": t.end_at,
            "created_at": t.created_at,
            "completed_at": t.completed_at,
            "is_repeating": t.is_repeating,
            "repeat_by": t.repeat_by,
            "repeat_until": t.repeat_until,
            "series_id": t.series_id,
            "user_id": t.user_id,
        }
        for t in tracked_tasks
    ]

    if project_repeating:

        def parse_date(d):
            return parser.isoparse(d) if isinstance(d, str) else d

        start = parse_date(start_date)
        end = parse_date(end_date)

        base_clauses = build_task_filters(
            user_id=user_id,
            category=category,
            search=search,
            is_completed=is_completed,
            duration=duration,
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

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "is_completed": task.is_completed,
        "start_at": task.start_at,
        "end_at": task.end_at,
        "created_at": task.created_at,
        "completed_at": task.completed_at,
        "is_repeating": task.is_repeating,
        "repeat_by": task.repeat_by,
        "repeat_until": task.repeat_until,
        "series_id": task.series_id,
        "user_id": task.user_id,
    }


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


def update_task(user_id, task_id, data: dict):
    task = db.session.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    ).scalar_one_or_none()

    if not task:
        return None

    old_task_dict = {
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

    for k, v in data.items():
        key = to_snake_case(k)
        if key in [
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
        ]:
            value = v.strip() if isinstance(v, str) else v
            value = bool(v) if key in ["is_completed", "is_repeating"] else value
            setattr(task, key, value)

    db.session.flush()

    updated_task_dict = {
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

    if check_should_repeat(old_task_dict, updated_task_dict):
        handle_repeat_task(user_id, old_task_dict)

    db.session.commit()
    return updated_task_dict


def delete_task(user_id, task_id):
    task = db.session.execute(
        select(Task).where(Task.user_id == user_id, Task.id == task_id)
    ).scalar_one_or_none()

    if task:
        db.session.delete(task)
        db.session.commit()
        return task_id
    return None
