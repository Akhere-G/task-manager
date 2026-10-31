import re
from collections.abc import Iterable, Iterator
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, TextClause, func, or_, select, text

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

if TYPE_CHECKING:
    from app.services.task_query import TaskQuery

Clause = ColumnElement[bool] | TextClause

MAX_SEARCH_LENGTH = 100
MAX_SEARCH_TERMS = 8
FULLTEXT_MIN_TERM_LENGTH = 3
SHORT_TASK_MINUTES = 30
MAX_GHOSTS = 5000

GHOST_COPIED_FIELDS = (
    "title",
    "description",
    "category",
    "is_completed",
    "created_at",
    "completed_at",
    "is_repeating",
    "repeat_by",
    "repeat_until",
    "repeat_interval",
    "repeat_days",
    "repeat_timezone",
    "user_id",
)


def parse_search(search: str | None) -> tuple[str, str] | None:
    """Full-text search only indexes terms of FULLTEXT_MIN_TERM_LENGTH or more, so
    shorter terms fall back to LIKE."""
    cleaned = " ".join(str(search or "").split())[:MAX_SEARCH_LENGTH]
    terms = re.findall(r"\w+", cleaned)[:MAX_SEARCH_TERMS]
    if not terms:
        return None
    if all(len(term) >= FULLTEXT_MIN_TERM_LENGTH for term in terms):
        return "fulltext", " ".join(f"+{term}*" for term in terms)
    return "like", cleaned


def _fulltext_clause(value: str) -> TextClause:
    table = Task.__tablename__
    return text(
        f"MATCH({table}.title, {table}.description) AGAINST(:search IN BOOLEAN MODE)"
    ).bindparams(search=value)


def _like_clause(value: str) -> ColumnElement[bool]:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Task.title.like(pattern, escape="\\"),
        Task.description.like(pattern, escape="\\"),
    )


def build_search_clause(search: str | None) -> Clause | None:
    plan = parse_search(search)
    if plan is None:
        return None
    mode, value = plan
    return _fulltext_clause(value) if mode == "fulltext" else _like_clause(value)


def _completion_clause(is_completed: str | bool | None) -> Clause | None:
    if is_completed is None or is_completed == "all":
        return None
    return Task.is_completed == (str(is_completed).lower() == "true")


def _date_range_clause(
    start_date: str | datetime | None, end_date: str | datetime | None
) -> Clause | None:
    if not start_date or not end_date:
        return None
    start = parse_iso(start_date)
    end = parse_iso(end_date)
    return Task.end_at.between(start_of_day(start.date()), end_of_day(end.date()))  # type: ignore


def _duration_clause(duration: str | None) -> Clause | None:
    minutes = func.timestampdiff(
        func.literal_column("MINUTE"), Task.start_at, Task.end_at
    )
    if duration == "short_tasks":
        return minutes <= SHORT_TASK_MINUTES
    if duration == "long_tasks":
        return minutes > SHORT_TASK_MINUTES
    return None


def build_task_clauses(user_id: int, query: "TaskQuery") -> list[Clause]:
    clauses: list[Clause] = [Task.user_id == user_id]
    if query.category and query.category != "all":
        clauses.append(Task.category == query.category)

    optional_clauses = (
        build_search_clause(query.search),
        _completion_clause(query.is_completed),
        _date_range_clause(query.start_date, query.end_date),
        _duration_clause(query.duration),
    )
    for clause in optional_clauses:
        if clause is not None:
            clauses.append(clause)
    return clauses


def snapshot(task: Task) -> Task:
    column_names = Task.__table__.columns.keys()
    return Task(**{name: getattr(task, name) for name in column_names})


def next_task_start(task: Task) -> datetime:
    return next_occurrence(
        task.start_at,
        task.repeat_by,  # type: ignore
        task.repeat_interval,
        task.repeat_days,
        get_zone(task.repeat_timezone),
    )


def _ghost(task: Task, start: datetime, end: datetime) -> Task:
    ghost = Task(
        **{name: getattr(task, name) for name in GHOST_COPIED_FIELDS},
        start_at=start,
        end_at=end,
        series_id=task.id,
    )
    ghost.id = f"ghost_{task.id}_{start:%Y%m%d}"  # type: ignore
    ghost.is_ghost = True  # type: ignore
    return ghost


def _occurrences(
    task: Task, view_start: datetime, view_end: datetime
) -> Iterator[tuple[datetime, datetime]]:
    zone = get_zone(task.repeat_timezone)

    def advance(start: datetime, end: datetime) -> tuple[datetime, datetime]:
        next_start = next_occurrence(
            start,
            task.repeat_by,  # type: ignore
            task.repeat_interval,
            task.repeat_days,
            zone,
        )
        return next_start, next_start + (end - start)

    first_start = as_aware_utc(task.start_at)
    start, end = first_start, as_aware_utc(task.end_at)
    if task.repeat_until:
        repeat_until = as_aware_utc(end_of_day(task.repeat_until))
    else:
        repeat_until = view_end

    while start < view_start:
        start, end = advance(start, end)
        if start >= repeat_until:
            return

    if start == first_start:
        start, end = advance(start, end)

    while start <= view_end and start <= repeat_until:
        yield start, end
        start, end = advance(start, end)


def with_repeating(
    tasks: list[Task],
    view_start: datetime | None,
    view_end: datetime | None,
    user_id: int,
    clauses: Iterable[Clause] = (),
) -> list[Task]:
    if view_start is None or view_end is None:
        print("View Start or view end was none. Could not repeat tasks")
        return tasks
    view_start = as_aware_utc(view_start)
    view_end = as_aware_utc(view_end)
    repeating_tasks = db.session.scalars(
        select(Task).where(
            Task.user_id == user_id,
            Task.is_repeating,
            or_(Task.repeat_until.is_(None), Task.repeat_until >= view_start),
            *clauses,
        )
    )

    ghosts = []
    for task in repeating_tasks:
        for start, end in _occurrences(task, view_start, view_end):
            ghosts.append(_ghost(task, start, end))
            if len(ghosts) >= MAX_GHOSTS:
                return [*tasks, *ghosts]
    return [*tasks, *ghosts]


def should_roll_series(task: Task, before: Task) -> bool:
    if not (task.is_repeating and task.is_completed and not before.is_completed):
        return False
    if not task.repeat_until:
        return True
    return end_of_day(task.repeat_until) >= next_task_start(task)


def _save_completed_occurrence(before: Task) -> None:
    db.session.add(
        Task(
            title=before.title,
            description=before.description,
            category=before.category,
            start_at=before.start_at,
            end_at=before.end_at,
            is_repeating=False,
            user_id=before.user_id,
            series_id=before.id,
            is_completed=True,
            completed_at=before.completed_at or utc_now(),
            created_at=before.created_at,
        )
    )


def _move_to_next_occurrence(task: Task, before: Task) -> None:
    next_start = next_task_start(before)
    task.start_at = next_start
    task.end_at = next_start + (before.end_at - before.start_at)
    task.is_completed = False
    task.completed_at = None
    task.series_id = task.id
    task.created_at = utc_now()


def roll_series(task: Task, before: Task) -> None:
    _save_completed_occurrence(before)
    _move_to_next_occurrence(task, before)
