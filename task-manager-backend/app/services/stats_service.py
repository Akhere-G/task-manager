from collections import Counter, defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Row,
    Select,
    and_,
    case,
    desc,
    func,
    literal_column,
    select,
)

from app.constants import CATEGORIES
from app.database import db
from app.models import Task
from app.utils.dates import as_aware_utc, as_naive_utc, start_of_day, utc_now
from app.utils.task_utils import with_repeating

Stats = list[dict[str, Any]]

TREND_DAYS = 366
PROJECTION_DAYS = 30
MAX_TURNAROUND_DAYS = 50
ACCURACY_DAYS = 30
OVERDUE_BUCKETS = ("< 3 Days", "1 Week", "1 Month", "3 Months", "+3 Months")

DURATION_MINUTES = func.timestampdiff(
    literal_column("MINUTE"), Task.start_at, Task.end_at
)
DURATION_SECONDS = func.timestampdiff(
    literal_column("SECOND"), Task.start_at, Task.end_at
)
COMPLETED_DATE = func.date(Task.completed_at)
END_DATE = func.date(Task.end_at)


def _rows(stmt: Select[Any]) -> Sequence[Row[Any]]:
    return db.session.execute(stmt).all()


def _count_if(condition: ColumnElement[bool]) -> ColumnElement[int]:
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def _is_overdue(now: datetime) -> ColumnElement[bool]:
    return and_(Task.is_completed.is_(False), Task.end_at < now)


def _is_pending(now: datetime) -> ColumnElement[bool]:
    return and_(Task.is_completed.is_(False), Task.end_at >= now)


def _upcoming_ghosts(user_id: int, now: datetime) -> list[Task]:
    view_end = now + timedelta(days=PROJECTION_DAYS)
    projected = with_repeating([], now, view_end, user_id)
    return [ghost for ghost in projected if not ghost.is_completed]


def _productivity_trend(user_id: int, now: datetime) -> Stats:
    first_day = now.date() - timedelta(days=TREND_DAYS - 1)
    rows = _rows(
        select(COMPLETED_DATE, func.count(), func.sum(DURATION_MINUTES))
        .where(
            Task.user_id == user_id,
            Task.is_completed,
            Task.completed_at >= start_of_day(first_day),
        )
        .group_by(COMPLETED_DATE)
    )
    by_day = {day: (count, int(minutes)) for day, count, minutes in rows}

    trend = []
    for offset in range(TREND_DAYS):
        day = first_day + timedelta(days=offset)
        tasks, time_spent = by_day.get(day, (0, 0))
        trend.append(
            {"date": day.isoformat(), "tasks": tasks, "time_spent": time_spent}
        )
    return trend


def _time_spent(user_id: int) -> Stats:
    minutes = func.sum(DURATION_MINUTES)
    rows = _rows(
        select(Task.category, minutes)
        .where(Task.user_id == user_id, Task.is_completed)
        .group_by(Task.category)
        .order_by(desc(minutes), Task.category)
    )
    return [
        {"category": category, "time_spent": int(total)} for category, total in rows
    ]


def _hourly_productivity(user_id: int) -> Stats:
    hour = func.hour(Task.completed_at)
    rows = _rows(
        select(hour, func.count())
        .where(Task.user_id == user_id, Task.is_completed)
        .group_by(hour)
    )
    counts = dict(rows)
    return [{"hour": hour, "count": counts.get(hour, 0)} for hour in range(24)]


def _turnaround_time(user_id: int) -> Stats:
    days_taken = func.datediff(Task.completed_at, Task.created_at)
    rows = _rows(
        select(days_taken, func.count())
        .where(Task.user_id == user_id, Task.is_completed, days_taken >= 0)
        .group_by(days_taken)
    )
    counts = dict(rows)
    shown_days = min(max(counts, default=0), MAX_TURNAROUND_DAYS) + 1
    return [
        {"days_taken": days, "count": counts.get(days, 0)} for days in range(shown_days)
    ]


def _estimation_accuracy(user_id: int, now: datetime) -> Stats:
    rows = _rows(
        select(Task.id, Task.title, Task.category, Task.end_at, Task.completed_at)
        .where(
            Task.user_id == user_id,
            Task.is_completed,
            Task.completed_at > now - timedelta(days=ACCURACY_DAYS),
        )
        .order_by(Task.completed_at)
    )
    return [
        {
            "id": task_id,
            "title": title,
            "category": category,
            "estimated_at": int(as_aware_utc(end_at).timestamp()),
            "completed_at": int(as_aware_utc(completed_at).timestamp()),
            "variance_minutes": int((end_at - completed_at).total_seconds() / 60),
        }
        for task_id, title, category, end_at, completed_at in rows
    ]


def _distribution_trend(user_id: int, now: datetime) -> Stats:
    first_day = now.date() - timedelta(days=6)
    rows = _rows(
        select(COMPLETED_DATE, Task.category, func.count())
        .where(
            Task.user_id == user_id,
            Task.is_completed,
            Task.completed_at >= start_of_day(first_day),
            Task.category.in_(CATEGORIES),
        )
        .group_by(COMPLETED_DATE, Task.category)
    )
    counts = {(day, category): count for day, category, count in rows}

    trend = []
    for offset in range(7):
        day = first_day + timedelta(days=offset)
        per_category = {
            category: counts.get((day, category), 0) for category in CATEGORIES
        }
        trend.append({"date": day.isoformat(), **per_category})
    return trend


def _category_volume(user_id: int, now: datetime, ghosts: list[Task]) -> Stats:
    rows = _rows(
        select(
            Task.category,
            _count_if(Task.is_completed),
            _count_if(_is_overdue(now)),
            _count_if(_is_pending(now)),
        )
        .where(Task.user_id == user_id)
        .group_by(Task.category)
    )
    volume = defaultdict(lambda: {"completed": 0, "overdue": 0, "pending": 0})
    for category, completed, overdue, pending in rows:
        volume[category] = {
            "completed": int(completed),
            "overdue": int(overdue),
            "pending": int(pending),
        }
    for category, count in Counter(ghost.category for ghost in ghosts).items():
        volume[category]["pending"] += count

    return [
        {
            "category": category,
            **volume[category],
            "total": sum(volume[category].values()),
        }
        for category in sorted(volume, reverse=True)
    ]


def _backlog_health(volume: Stats) -> Stats:
    return [
        {"status": "Completed", "count": sum(v["completed"] for v in volume)},
        {"status": "Overdue", "count": sum(v["overdue"] for v in volume)},
        {"status": "Pending", "count": sum(v["pending"] for v in volume)},
    ]


def _overdue_distribution(user_id: int, now: datetime) -> Stats:
    days_late = func.timestampdiff(literal_column("DAY"), Task.end_at, now)
    bucket = case(
        (days_late <= 3, OVERDUE_BUCKETS[0]),
        (days_late <= 7, OVERDUE_BUCKETS[1]),
        (days_late <= 30, OVERDUE_BUCKETS[2]),
        (days_late <= 90, OVERDUE_BUCKETS[3]),
        else_=OVERDUE_BUCKETS[4],
    )
    rows = _rows(
        select(bucket, func.count())
        .where(Task.user_id == user_id, _is_overdue(now))
        .group_by(bucket)
    )
    counts = dict(rows)
    return [
        {"days_overdue": name, "count": counts[name]}
        for name in OVERDUE_BUCKETS
        if name in counts
    ]


def _deadline_proximity(user_id: int, now: datetime, ghosts: list[Task]) -> Stats:
    time_left = func.timestampdiff(literal_column("SECOND"), now, Task.end_at)
    rows = _rows(
        select(Task.category, func.sum(time_left), func.count())
        .where(Task.user_id == user_id, Task.is_completed.is_(False))
        .group_by(Task.category)
    )
    seconds_by_category = {category: int(seconds) for category, seconds, _ in rows}
    tasks_by_category = {category: count for category, _, count in rows}

    for ghost in ghosts:
        seconds = int((as_naive_utc(ghost.end_at) - now).total_seconds())
        category = ghost.category
        seconds_by_category[category] = seconds_by_category.get(category, 0) + seconds
        tasks_by_category[category] = tasks_by_category.get(category, 0) + 1

    scores = [
        {"category": category, "score": seconds / tasks_by_category[category] / 86400}
        for category, seconds in seconds_by_category.items()
    ]
    return sorted(scores, key=lambda s: s["score"], reverse=True)


def _week_overview(user_id: int, now: datetime, ghosts: list[Task]) -> Stats:
    week_start = start_of_day(now.date())
    week_end = week_start + timedelta(days=7)
    rows = _rows(
        select(END_DATE, func.count(), func.sum(DURATION_SECONDS))
        .where(
            Task.user_id == user_id,
            Task.is_completed.is_(False),
            Task.end_at >= week_start,
            Task.end_at < week_end,
        )
        .group_by(END_DATE)
    )
    per_day = {day: [count, int(seconds)] for day, count, seconds in rows}

    for ghost in ghosts:
        end = as_naive_utc(ghost.end_at)
        if week_start <= end < week_end:
            totals = per_day.setdefault(end.date(), [0, 0])
            totals[0] += 1
            totals[1] += int((ghost.end_at - ghost.start_at).total_seconds())

    return [
        {
            "date": day.isoformat(),
            "totalMinutes": seconds / 60,
            "total_hours": f"{seconds / 3600:.2f}",
            "count": count,
        }
        for day, (count, seconds) in sorted(per_day.items())
    ]


def get_brief_stats(user_id: int) -> dict[str, Stats]:
    now = utc_now()
    ghosts = _upcoming_ghosts(user_id, now)
    return {
        "productivity": _productivity_trend(user_id, now),
        "categoryVolume": _category_volume(user_id, now, ghosts),
    }


def get_all_dashboard_stats(user_id: int) -> dict[str, Stats]:
    now = utc_now()
    ghosts = _upcoming_ghosts(user_id, now)
    volume = _category_volume(user_id, now, ghosts)

    return {
        "productivity": _productivity_trend(user_id, now),
        "timeSpent": _time_spent(user_id),
        "backlogHealth": _backlog_health(volume),
        "categoryVolume": volume,
        "overdueDistribution": _overdue_distribution(user_id, now),
        "deadlineProximity": _deadline_proximity(user_id, now, ghosts),
        "hourlyProductivity": _hourly_productivity(user_id),
        "turnaround": _turnaround_time(user_id),
        "estimationAccuracy": _estimation_accuracy(user_id, now),
        "weekOverview": _week_overview(user_id, now, ghosts),
        "distributionTrend": _distribution_trend(user_id, now),
    }
