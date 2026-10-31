import re
from datetime import date
from sqlalchemy import select, func, or_, text
from app.database import db
from app.models import Task
from app.utils.dates import (
    as_aware_utc,
    end_of_day,
    get_zone,
    parse_iso,
    start_of_day,
    utc_now,
)
from app.utils.recurrence import next_occurrence
from dateutil import parser


MAX_SEARCH_LENGTH = 100
MAX_SEARCH_TERMS = 8
FULLTEXT_MIN_TERM_LENGTH = 3


def parse_search(search):
    cleaned = " ".join(str(search or "").split())[:MAX_SEARCH_LENGTH]
    terms = re.findall(r"\w+", cleaned)[:MAX_SEARCH_TERMS]
    if not terms:
        return None
    if all(len(term) >= FULLTEXT_MIN_TERM_LENGTH for term in terms):
        return "fulltext", " ".join(f"+{term}*" for term in terms)
    return "like", cleaned


def build_search_clause(search):
    plan = parse_search(search)
    if plan is None:
        return None

    mode, value = plan
    if mode == "fulltext":
        table = Task.__tablename__
        return text(
            f"MATCH({table}.title, {table}.description) "
            "AGAINST(:search IN BOOLEAN MODE)"
        ).bindparams(search=value)

    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Task.title.like(pattern, escape="\\"),
        Task.description.like(pattern, escape="\\"),
    )


def build_task_filters(user_id, query):
    category = query.category
    is_completed = query.is_completed
    start_date = query.start_date
    end_date = query.end_date
    duration = query.duration
    clauses = [Task.user_id == user_id]

    if category and category != "all":
        clauses.append(Task.category == category)

    search_clause = build_search_clause(query.search)
    if search_clause is not None:
        clauses.append(search_clause)

    if is_completed is not None and is_completed != "all":
        val = True if str(is_completed).lower() == "true" else False
        clauses.append(Task.is_completed == val)

    if start_date and end_date:
        start_dt = start_of_day(parser.isoparse(str(start_date)).date())
        end_dt = end_of_day(parser.isoparse(str(end_date)).date())
        clauses.append(Task.end_at.between(start_dt, end_dt))

    if duration in ["short_tasks", "long_tasks"]:
        diff = func.timestampdiff(
            func.literal_column("MINUTE"), Task.start_at, Task.end_at
        )
        if duration == "short_tasks":
            clauses.append(diff <= 30)
        else:
            clauses.append(diff > 30)

    return clauses


MAX_GHOSTS = 5000


def with_repeating(tasks, view_start, view_end, user_id, additional_clauses=None):
    ghost_count = 0
    view_start = as_aware_utc(view_start)
    view_end = as_aware_utc(view_end)
    clauses = [
        Task.user_id == user_id,
        Task.is_repeating,
        or_(Task.repeat_until.is_(None), Task.repeat_until >= view_start),
    ]

    if additional_clauses:
        clauses.extend(additional_clauses)

    repeating_tasks = db.session.execute(select(Task).where(*clauses)).scalars().all()

    for task in repeating_tasks:
        zone = get_zone(task.repeat_timezone)

        def advance(start, end, task=task, zone=zone):
            next_start = next_occurrence(
                start, task.repeat_by, task.repeat_interval, task.repeat_days, zone
            )
            return next_start, next_start + (end - start)

        instance_start = as_aware_utc(task.start_at)
        instance_end = as_aware_utc(task.end_at)
        task_start_at = instance_start

        if task.repeat_until:
            repeat_until = as_aware_utc(end_of_day(task.repeat_until))
        else:
            repeat_until = view_end

        while instance_start < view_start:
            instance_start, instance_end = advance(instance_start, instance_end)

            if repeat_until and instance_start >= repeat_until:
                break

        if task_start_at == instance_start:
            instance_start, instance_end = advance(instance_start, instance_end)

        while instance_start <= view_end:
            if repeat_until and instance_start > repeat_until:
                break

            ghost_task = {
                "id": f"ghost_{task.id}_{instance_start.strftime('%Y%m%d')}",
                "title": task.title,
                "description": task.description,
                "category": task.category,
                "is_completed": task.is_completed,
                "start_at": instance_start,
                "end_at": instance_end,
                "created_at": task.created_at,
                "completed_at": task.completed_at,
                "is_repeating": task.is_repeating,
                "repeat_by": task.repeat_by,
                "repeat_until": task.repeat_until,
                "repeat_interval": task.repeat_interval,
                "repeat_days": task.repeat_days,
                "repeat_timezone": task.repeat_timezone,
                "series_id": task.id,
                "user_id": task.user_id,
                "is_ghost": True,
            }
            tasks.append(ghost_task)
            ghost_count += 1
            if ghost_count >= MAX_GHOSTS:
                return tasks

            instance_start, instance_end = advance(instance_start, instance_end)

    return tasks


def check_should_repeat(old_task, updated_task):
    if (
        updated_task.get("is_repeating")
        and updated_task.get("is_completed")
        and not old_task.get("is_completed")
    ):
        repeat_until_val = updated_task.get("repeat_until")

        if isinstance(repeat_until_val, str):
            repeat_until_val = date.fromisoformat(repeat_until_val)
        if isinstance(repeat_until_val, date):
            repeat_until_val = end_of_day(repeat_until_val)

        start_at = parse_iso(updated_task.get("start_at"))

        next_start = next_occurrence(
            start_at,
            updated_task.get("repeat_by"),
            updated_task.get("repeat_interval"),
            updated_task.get("repeat_days"),
            get_zone(updated_task.get("repeat_timezone")),
        )

        return not repeat_until_val or repeat_until_val >= next_start
    return False


def handle_repeat_task(user_id, original_task):
    history_task = Task(
        title=original_task["title"],
        description=original_task["description"],
        category=original_task["category"],
        start_at=original_task["start_at"],
        end_at=original_task["end_at"],
        is_repeating=False,
        user_id=user_id,
        series_id=original_task["id"],
        is_completed=True,
        completed_at=original_task["completed_at"] or utc_now(),
        created_at=original_task["created_at"],
    )
    db.session.add(history_task)

    next_start = next_occurrence(
        original_task["start_at"],
        original_task["repeat_by"],
        original_task.get("repeat_interval"),
        original_task.get("repeat_days"),
        get_zone(original_task.get("repeat_timezone")),
    )
    next_end = next_start + (original_task["end_at"] - original_task["start_at"])

    current_task = db.session.execute(
        select(Task).where(Task.id == original_task["id"])
    ).scalar_one_or_none()

    if current_task:
        current_task.start_at = next_start
        current_task.end_at = next_end
        current_task.is_completed = False
        current_task.completed_at = None
        current_task.series_id = current_task.id
        current_task.created_at = utc_now()

