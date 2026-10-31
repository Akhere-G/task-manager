import re

from sqlalchemy import func, or_, select, text

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

MAX_SEARCH_LENGTH = 100
MAX_SEARCH_TERMS = 8
FULLTEXT_MIN_TERM_LENGTH = 3
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
    clauses = [Task.user_id == user_id]

    if query.category and query.category != "all":
        clauses.append(Task.category == query.category)

    search_clause = build_search_clause(query.search)
    if search_clause is not None:
        clauses.append(search_clause)

    if query.is_completed is not None and query.is_completed != "all":
        clauses.append(Task.is_completed == (str(query.is_completed).lower() == "true"))

    if query.start_date and query.end_date:
        clauses.append(
            Task.end_at.between(
                start_of_day(parse_iso(query.start_date).date()),
                end_of_day(parse_iso(query.end_date).date()),
            )
        )

    if query.duration in ("short_tasks", "long_tasks"):
        diff = func.timestampdiff(
            func.literal_column("MINUTE"), Task.start_at, Task.end_at
        )
        clauses.append(diff <= 30 if query.duration == "short_tasks" else diff > 30)

    return clauses


def snapshot(task):
    """A detached copy of the task as it is now, to compare against after an update."""
    return Task(**{name: getattr(task, name) for name in Task.__table__.columns.keys()})


def _ghost(task, start, end):
    ghost = Task(
        **{name: getattr(task, name) for name in GHOST_COPIED_FIELDS},
        start_at=start,
        end_at=end,
        series_id=task.id,
    )
    ghost.id = f"ghost_{task.id}_{start:%Y%m%d}"
    ghost.is_ghost = True
    return ghost


def _occurrences(task, view_start, view_end):
    """Start and end of each future occurrence of a repeating task inside the view."""
    zone = get_zone(task.repeat_timezone)

    def advance(start, end):
        next_start = next_occurrence(
            start, task.repeat_by, task.repeat_interval, task.repeat_days, zone
        )
        return next_start, next_start + (end - start)

    first_start = as_aware_utc(task.start_at)
    start, end = first_start, as_aware_utc(task.end_at)
    repeat_until = (
        as_aware_utc(end_of_day(task.repeat_until)) if task.repeat_until else view_end
    )

    while start < view_start:
        start, end = advance(start, end)
        if start >= repeat_until:
            return

    if start == first_start:
        start, end = advance(start, end)

    while start <= view_end and start <= repeat_until:
        yield start, end
        start, end = advance(start, end)


def with_repeating(tasks, view_start, view_end, user_id, additional_clauses=None):
    """`tasks` plus a ghost `Task` for every occurrence of a repeating task in the view."""
    view_start = as_aware_utc(view_start)
    view_end = as_aware_utc(view_end)
    clauses = [
        Task.user_id == user_id,
        Task.is_repeating,
        or_(Task.repeat_until.is_(None), Task.repeat_until >= view_start),
        *(additional_clauses or []),
    ]
    repeating_tasks = db.session.scalars(select(Task).where(*clauses))

    ghosts = []
    for task in repeating_tasks:
        for start, end in _occurrences(task, view_start, view_end):
            ghosts.append(_ghost(task, start, end))
            if len(ghosts) >= MAX_GHOSTS:
                return [*tasks, *ghosts]
    return [*tasks, *ghosts]


def check_should_repeat(old, task):
    """Whether this update completed a repeating task that still has a next occurrence."""
    if not (task.is_repeating and task.is_completed and not old.is_completed):
        return False

    next_start = next_occurrence(
        task.start_at,
        task.repeat_by,
        task.repeat_interval,
        task.repeat_days,
        get_zone(task.repeat_timezone),
    )
    return not task.repeat_until or end_of_day(task.repeat_until) >= next_start


def roll_series(task, old):
    """Record the occurrence just completed as history and move `task` to the next one."""
    db.session.add(
        Task(
            title=old.title,
            description=old.description,
            category=old.category,
            start_at=old.start_at,
            end_at=old.end_at,
            is_repeating=False,
            user_id=old.user_id,
            series_id=old.id,
            is_completed=True,
            completed_at=old.completed_at or utc_now(),
            created_at=old.created_at,
        )
    )

    next_start = next_occurrence(
        old.start_at,
        old.repeat_by,
        old.repeat_interval,
        old.repeat_days,
        get_zone(old.repeat_timezone),
    )
    task.start_at = next_start
    task.end_at = next_start + (old.end_at - old.start_at)
    task.is_completed = False
    task.completed_at = None
    task.series_id = task.id
    task.created_at = utc_now()
