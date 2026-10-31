"""Dashboard statistics.

History (what was completed, and when) is aggregated in SQL over real tasks. The
forward-looking numbers (pending work, deadlines, the week ahead) also count the
projected occurrences of repeating tasks for the next 30 days ("ghosts").
"""

from collections import Counter, defaultdict
from datetime import timedelta

from sqlalchemy import and_, case, desc, func, literal_column, select

from app.constants import CATEGORIES
from app.database import db
from app.models import Task
from app.utils.dates import as_aware_utc, as_naive_utc, start_of_day, utc_now
from app.utils.task_utils import with_repeating

TREND_DAYS = 366
PROJECTION_DAYS = 30
MAX_TURNAROUND_DAYS = 50
ACCURACY_DAYS = 30
OVERDUE_BUCKETS = ("< 3 Days", "1 Week", "1 Month", "3 Months", "+3 Months")

DURATION_MINUTES = func.timestampdiff(literal_column("MINUTE"), Task.start_at, Task.end_at)
DURATION_SECONDS = func.timestampdiff(literal_column("SECOND"), Task.start_at, Task.end_at)
COMPLETED_DATE = func.date(Task.completed_at)
END_DATE = func.date(Task.end_at)


def _rows(stmt):
    return db.session.execute(stmt).all()


def _count_if(condition):
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def _open(now):
    """Conditions for open tasks that ended before `now` (overdue) or have not (pending)."""
    open_task = Task.is_completed.is_(False)
    return (
        and_(open_task, Task.end_at < now),
        and_(open_task, Task.end_at >= now),
    )


def _upcoming_ghosts(user_id, now):
    """Projected occurrences of repeating tasks over the next 30 days."""
    projected = with_repeating([], now, now + timedelta(days=PROJECTION_DAYS), user_id)
    return [ghost for ghost in projected if not ghost.is_completed]


# --- History: SQL over completed tasks --------------------------------------


def _productivity_trend(user_id, now):
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
    days = (first_day + timedelta(days=i) for i in range(TREND_DAYS))
    return [
        {"date": day.isoformat(), "tasks": by_day.get(day, (0, 0))[0], "time_spent": by_day.get(day, (0, 0))[1]}
        for day in days
    ]


def _time_spent(user_id):
    minutes = func.sum(DURATION_MINUTES)
    rows = _rows(
        select(Task.category, minutes)
        .where(Task.user_id == user_id, Task.is_completed)
        .group_by(Task.category)
        .order_by(desc(minutes), Task.category)
    )
    return [{"category": category, "time_spent": int(total)} for category, total in rows]


def _hourly_productivity(user_id):
    hour = func.hour(Task.completed_at)
    counts = dict(
        _rows(
            select(hour, func.count())
            .where(Task.user_id == user_id, Task.is_completed)
            .group_by(hour)
        )
    )
    return [{"hour": h, "count": counts.get(h, 0)} for h in range(24)]


def _turnaround_time(user_id):
    days_taken = func.datediff(Task.completed_at, Task.created_at)
    counts = dict(
        _rows(
            select(days_taken, func.count())
            .where(Task.user_id == user_id, Task.is_completed, days_taken >= 0)
            .group_by(days_taken)
        )
    )
    shown = min(max(counts, default=0) + 1, MAX_TURNAROUND_DAYS + 1)
    return [{"days_taken": d, "count": counts.get(d, 0)} for d in range(shown)]


def _estimation_accuracy(user_id, now):
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


def _distribution_trend(user_id, now):
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
    days = [first_day + timedelta(days=i) for i in range(7)]
    return [
        {"date": day.isoformat(), **{c: counts.get((day, c), 0) for c in CATEGORIES}}
        for day in days
    ]


# --- Backlog: SQL over open tasks, plus projected occurrences ---------------


def _category_volume(user_id, now, ghosts):
    overdue, pending = _open(now)
    rows = _rows(
        select(
            Task.category,
            _count_if(Task.is_completed),
            _count_if(overdue),
            _count_if(pending),
        )
        .where(Task.user_id == user_id)
        .group_by(Task.category)
    )
    volume = {
        category: {"completed": int(done), "overdue": int(late), "pending": int(due)}
        for category, done, late, due in rows
    }
    for category, count in Counter(g.category for g in ghosts).items():
        volume.setdefault(category, {"completed": 0, "overdue": 0, "pending": 0})
        volume[category]["pending"] += count

    return [
        {"category": category, **counts, "total": sum(counts.values())}
        for category, counts in sorted(volume.items(), key=lambda item: item[0], reverse=True)
    ]


def _backlog_health(volume):
    return [
        {"status": status, "count": sum(v[key] for v in volume)}
        for status, key in (("Completed", "completed"), ("Overdue", "overdue"), ("Pending", "pending"))
    ]


def _overdue_distribution(user_id, now):
    days_late = func.timestampdiff(literal_column("DAY"), Task.end_at, now)
    bucket = case(
        (days_late <= 3, OVERDUE_BUCKETS[0]),
        (days_late <= 7, OVERDUE_BUCKETS[1]),
        (days_late <= 30, OVERDUE_BUCKETS[2]),
        (days_late <= 90, OVERDUE_BUCKETS[3]),
        else_=OVERDUE_BUCKETS[4],
    )
    overdue, _ = _open(now)
    counts = dict(
        _rows(select(bucket, func.count()).where(Task.user_id == user_id, overdue).group_by(bucket))
    )
    return [
        {"days_overdue": name, "count": counts[name]}
        for name in OVERDUE_BUCKETS
        if name in counts
    ]


def _deadline_proximity(user_id, now, ghosts):
    seconds_left = func.timestampdiff(literal_column("SECOND"), now, Task.end_at)
    rows = _rows(
        select(Task.category, func.sum(seconds_left), func.count())
        .where(Task.user_id == user_id, Task.is_completed.is_(False))
        .group_by(Task.category)
    )
    totals = defaultdict(lambda: [0, 0])
    for category, seconds, count in rows:
        totals[category] = [int(seconds), count]
    for ghost in ghosts:
        totals[ghost.category][0] += int((as_naive_utc(ghost.end_at) - now).total_seconds())
        totals[ghost.category][1] += 1

    scores = [
        {"category": category, "score": seconds / count / 86400.0}
        for category, (seconds, count) in totals.items()
    ]
    return sorted(scores, key=lambda s: s["score"], reverse=True)


def _week_overview(user_id, now, ghosts):
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
    days = {day: [count, int(seconds)] for day, count, seconds in rows}
    for ghost in ghosts:
        end = as_naive_utc(ghost.end_at)
        if week_start <= end < week_end:
            day = days.setdefault(end.date(), [0, 0])
            day[0] += 1
            day[1] += int((ghost.end_at - ghost.start_at).total_seconds())

    return [
        {
            "date": day.isoformat(),
            "totalMinutes": seconds / 60.0,
            "total_hours": f"{seconds / 3600:.2f}",
            "count": count,
        }
        for day, (count, seconds) in sorted(days.items())
    ]


def get_brief_stats(user_id):
    now = utc_now()
    ghosts = _upcoming_ghosts(user_id, now)
    return {
        "productivity": _productivity_trend(user_id, now),
        "categoryVolume": _category_volume(user_id, now, ghosts),
    }


def get_all_dashboard_stats(user_id):
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
