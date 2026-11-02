from collections import Counter, defaultdict
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Row,
    Select,
    and_,
    case,
    func,
    literal_column,
    select,
)

from app.database import db
from app.models import Task
from app.services.project_service import root_project_names
from app.utils.dates import as_aware_utc, as_naive_utc, start_of_day, utc_now
from app.utils.task_utils import live_tasks_of, with_repeating

Stats = list[dict[str, Any]]
ProjectNames = dict[int | None, str]

TREND_PROJECTS = 8
OTHER_NAME = "Other"

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
            live_tasks_of(user_id),
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


def _time_spent(user_id: int, names: ProjectNames) -> Stats:
    rows = _rows(
        select(Task.project_id, func.sum(DURATION_MINUTES))
        .where(live_tasks_of(user_id), Task.is_completed)
        .group_by(Task.project_id)
    )
    totals: Counter[str] = Counter()
    for project_id, minutes in rows:
        totals[names[project_id]] += int(minutes)
    ranked = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    return [{"project": name, "time_spent": total} for name, total in ranked]


def _hourly_productivity(user_id: int) -> Stats:
    hour = func.hour(Task.completed_at)
    rows = _rows(
        select(hour, func.count())
        .where(live_tasks_of(user_id), Task.is_completed)
        .group_by(hour)
    )
    counts = dict(rows)
    return [{"hour": hour, "count": counts.get(hour, 0)} for hour in range(24)]


def _turnaround_time(user_id: int) -> Stats:
    days_taken = func.datediff(Task.completed_at, Task.created_at)
    rows = _rows(
        select(days_taken, func.count())
        .where(live_tasks_of(user_id), Task.is_completed, days_taken >= 0)
        .group_by(days_taken)
    )
    counts = dict(rows)
    shown_days = min(max(counts, default=0), MAX_TURNAROUND_DAYS) + 1
    return [
        {"days_taken": days, "count": counts.get(days, 0)} for days in range(shown_days)
    ]


def _estimation_accuracy(user_id: int, now: datetime, names: ProjectNames) -> Stats:
    rows = _rows(
        select(Task.id, Task.title, Task.project_id, Task.end_at, Task.completed_at)
        .where(
            live_tasks_of(user_id),
            Task.is_completed,
            Task.completed_at > now - timedelta(days=ACCURACY_DAYS),
        )
        .order_by(Task.completed_at)
    )
    return [
        {
            "id": task_id,
            "title": title,
            "project": names[project_id],
            "estimated_at": int(as_aware_utc(end_at).timestamp()),
            "completed_at": int(as_aware_utc(completed_at).timestamp()),
            "variance_minutes": int((end_at - completed_at).total_seconds() / 60),
        }
        for task_id, title, project_id, end_at, completed_at in rows
    ]


def _distribution_trend(user_id: int, now: datetime, names: ProjectNames) -> Stats:
    first_day = now.date() - timedelta(days=6)
    rows = _rows(
        select(COMPLETED_DATE, Task.project_id, func.count())
        .where(
            live_tasks_of(user_id),
            Task.is_completed,
            Task.completed_at >= start_of_day(first_day),
        )
        .group_by(COMPLETED_DATE, Task.project_id)
    )
    counts: Counter[tuple[date, str]] = Counter()
    totals: Counter[str] = Counter()
    for day, project_id, count in rows:
        counts[(day, names[project_id])] += count
        totals[names[project_id]] += count

    ranked = sorted(totals, key=lambda name: (-totals[name], name))
    shown = ranked[:TREND_PROJECTS]
    has_other = len(ranked) > TREND_PROJECTS
    series = [*shown, OTHER_NAME] if has_other else shown

    trend = []
    for offset in range(7):
        day = first_day + timedelta(days=offset)
        per_project = {name: counts.get((day, name), 0) for name in shown}
        if has_other:
            per_project[OTHER_NAME] = sum(
                counts.get((day, name), 0) for name in ranked[TREND_PROJECTS:]
            )
        trend.append(
            {
                "date": day.isoformat(),
                "counts": [
                    {"project": name, "count": per_project[name]} for name in series
                ],
            }
        )
    return trend


def _project_volume(
    user_id: int, now: datetime, ghosts: list[Task], names: ProjectNames
) -> Stats:
    rows = _rows(
        select(
            Task.project_id,
            _count_if(Task.is_completed),
            _count_if(_is_overdue(now)),
            _count_if(_is_pending(now)),
        )
        .where(live_tasks_of(user_id))
        .group_by(Task.project_id)
    )
    volume = defaultdict(lambda: {"completed": 0, "overdue": 0, "pending": 0})
    for project_id, completed, overdue, pending in rows:
        entry = volume[names[project_id]]
        entry["completed"] += int(completed)
        entry["overdue"] += int(overdue)
        entry["pending"] += int(pending)
    for name, count in Counter(names[ghost.project_id] for ghost in ghosts).items():
        volume[name]["pending"] += count

    return [
        {"project": name, **volume[name], "total": sum(volume[name].values())}
        for name in sorted(volume, reverse=True)
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
        .where(live_tasks_of(user_id), _is_overdue(now))
        .group_by(bucket)
    )
    counts = dict(rows)
    return [
        {"days_overdue": name, "count": counts[name]}
        for name in OVERDUE_BUCKETS
        if name in counts
    ]


def _deadline_proximity(
    user_id: int, now: datetime, ghosts: list[Task], names: ProjectNames
) -> Stats:
    time_left = func.timestampdiff(literal_column("SECOND"), now, Task.end_at)
    rows = _rows(
        select(Task.project_id, func.sum(time_left), func.count())
        .where(live_tasks_of(user_id), Task.is_completed.is_(False))
        .group_by(Task.project_id)
    )
    seconds_by_project: Counter[str] = Counter()
    tasks_by_project: Counter[str] = Counter()
    for project_id, seconds, count in rows:
        seconds_by_project[names[project_id]] += int(seconds)
        tasks_by_project[names[project_id]] += count

    for ghost in ghosts:
        name = names[ghost.project_id]
        seconds_by_project[name] += int(
            (as_naive_utc(ghost.end_at) - now).total_seconds()
        )
        tasks_by_project[name] += 1

    scores = [
        {"project": name, "score": seconds / tasks_by_project[name] / 86400}
        for name, seconds in seconds_by_project.items()
    ]
    return sorted(scores, key=lambda s: s["score"], reverse=True)


def _week_overview(user_id: int, now: datetime, ghosts: list[Task]) -> Stats:
    week_start = start_of_day(now.date())
    week_end = week_start + timedelta(days=7)
    rows = _rows(
        select(END_DATE, func.count(), func.sum(DURATION_SECONDS))
        .where(
            live_tasks_of(user_id),
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
    names = root_project_names(user_id)
    return {
        "productivity": _productivity_trend(user_id, now),
        "projectVolume": _project_volume(user_id, now, ghosts, names),
    }


def get_all_dashboard_stats(user_id: int) -> dict[str, Stats]:
    now = utc_now()
    ghosts = _upcoming_ghosts(user_id, now)
    names = root_project_names(user_id)
    volume = _project_volume(user_id, now, ghosts, names)

    return {
        "productivity": _productivity_trend(user_id, now),
        "timeSpent": _time_spent(user_id, names),
        "backlogHealth": _backlog_health(volume),
        "projectVolume": volume,
        "overdueDistribution": _overdue_distribution(user_id, now),
        "deadlineProximity": _deadline_proximity(user_id, now, ghosts, names),
        "hourlyProductivity": _hourly_productivity(user_id),
        "turnaround": _turnaround_time(user_id),
        "estimationAccuracy": _estimation_accuracy(user_id, now, names),
        "weekOverview": _week_overview(user_id, now, ghosts),
        "distributionTrend": _distribution_trend(user_id, now, names),
    }
