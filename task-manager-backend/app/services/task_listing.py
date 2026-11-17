from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

from sqlalchemy import UnaryExpression, asc, case, desc, func, select

from app.constants import MAX_TASKS_PER_REQUEST
from app.database import db
from app.models import Task
from app.services.label_service import attach_label_ids
from app.services.reminder_service import attach_reminders
from app.services.subtask_service import attach_subtask_counts
from app.services.task_query import TaskQuery
from app.utils.dates import as_naive_utc, parse_iso
from app.utils.task_utils import (
    DURATION_MINUTES,
    build_task_clauses,
    top_level_tasks_of,
    with_repeating,
)
from app.utils.views import (
    COUNTED_VIEWS,
    RANGED_VIEWS,
    Window,
    view_clause,
    view_window,
)


@dataclass(frozen=True, slots=True)
class _Page:
    tasks: list[Task]
    total: int
    total_minutes: int
    limit: int


def _task_minutes(task: Task) -> int:
    if task.start_at is None or task.end_at is None:
        return 0
    return int((task.end_at - task.start_at).total_seconds() // 60)


def _sort_clauses(query: TaskQuery) -> list[UnaryExpression[Any]]:
    columns = {
        "created_at": Task.created_at,
        "title": Task.title,
        "start_at": Task.start_at,
        "duration": DURATION_MINUTES,
        "priority": Task.priority,
        "manual": Task.sort_order,
    }
    column = columns.get(query.sort_by, Task.created_at)  # type: ignore
    direction = desc if query.order == "desc" else asc
    clauses = [direction(column)]
    if query.sort_by in ("start_at", "duration"):
        clauses.insert(0, column.is_(None))
    if query.sort_by == "priority":
        clauses.append(asc(Task.start_at))
    if query.sort_by == "manual":
        clauses.append(asc(Task.id))
    return clauses


def _page_size(query: TaskQuery, total: int) -> int:
    return max(query.limit or min(total, MAX_TASKS_PER_REQUEST), 1)


def _projection_window(query: TaskQuery) -> Window | None:
    if query.start_date and query.end_date:
        return parse_iso(query.start_date), parse_iso(query.end_date)  # type: ignore
    return view_window(query.view, query.zone)


def _sorted_by_start(tasks: list[Task], query: TaskQuery) -> list[Task]:
    if query.sort_by != "start_at":
        return tasks

    def start(task: Task) -> datetime:
        return as_naive_utc(task.start_at) if task.start_at else datetime.max

    return sorted(tasks, key=start, reverse=query.order == "desc")


def _with_ghosts(user_id: int, query: TaskQuery, tasks: list[Task]) -> list[Task]:
    window = _projection_window(query)
    if window is None:
        return tasks
    unranged = replace(query, start_date=None, end_date=None, view=None)
    clauses = build_task_clauses(user_id, unranged)
    return _sorted_by_start(with_repeating(tasks, *window, user_id, clauses), query)


def _select_all(user_id: int, query: TaskQuery) -> list[Task]:
    clauses = build_task_clauses(user_id, query)
    stmt = (
        select(Task)
        .where(*clauses)
        .order_by(*_sort_clauses(query), Task.id)
        .limit(MAX_TASKS_PER_REQUEST)
    )
    return list(db.session.scalars(stmt))


def _select_page(user_id: int, query: TaskQuery) -> _Page:
    clauses = build_task_clauses(user_id, query)
    total, total_minutes = db.session.execute(
        select(func.count(), func.coalesce(func.sum(DURATION_MINUTES), 0))
        .select_from(Task)
        .where(*clauses)
    ).one()
    limit = _page_size(query, total)
    stmt = (
        select(Task)
        .where(*clauses)
        .order_by(*_sort_clauses(query), Task.id)
        .limit(limit)
        .offset(limit * (max(query.page or 1, 1) - 1))
    )
    return _Page(list(db.session.scalars(stmt)), total, int(total_minutes), limit)


def _slice_page(tasks: list[Task], query: TaskQuery) -> _Page:
    limit = _page_size(query, len(tasks))
    offset = limit * (max(query.page or 1, 1) - 1)
    total_minutes = sum(_task_minutes(task) for task in tasks)
    return _Page(tasks[offset : offset + limit], len(tasks), total_minutes, limit)


def get_all_tasks(user_id: int, query: TaskQuery | None = None) -> dict[str, Any]:
    query = query or TaskQuery()
    if query.project_repeating:
        everything = _with_ghosts(user_id, query, _select_all(user_id, query))
        page = _slice_page(everything, query)
    else:
        page = _select_page(user_id, query)
    tasks = page.tasks

    attach_label_ids(tasks)
    attach_reminders(tasks)
    attach_subtask_counts(tasks)
    return {
        "tasks": tasks,
        "total_tasks": page.total,
        "total_minutes": page.total_minutes,
        "total_pages": (page.total + page.limit - 1) // page.limit,
        "current_page": max(query.page or 1, 1),
    }


def _count_ghosts_by_view(user_id: int, zone_name: str | None) -> dict[str, int]:
    open_clauses = build_task_clauses(user_id, TaskQuery(is_completed="false"))
    counts: dict[str, int] = {}
    for view in RANGED_VIEWS:
        window = view_window(view, zone_name)
        counts[view] = len(with_repeating([], *window, user_id, open_clauses))  # type: ignore
    return counts


def count_open_tasks_by_view(
    user_id: int, zone_name: str | None = None
) -> dict[str, int]:
    """Counts what each view lists, including projected repeating occurrences."""
    counts = [
        func.coalesce(func.sum(case((view_clause(view, zone_name), 1), else_=0)), 0)
        for view in COUNTED_VIEWS
    ]
    row = db.session.execute(
        select(*counts).where(top_level_tasks_of(user_id), Task.is_completed.is_(False))
    ).one()
    saved = {view: int(count) for view, count in zip(COUNTED_VIEWS, row, strict=True)}
    ghosts = _count_ghosts_by_view(user_id, zone_name)
    return {view: count + ghosts.get(view, 0) for view, count in saved.items()}
