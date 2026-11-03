"""Smart views: named windows of time, resolved in the viewer's time zone."""

from datetime import date, datetime, time, timedelta, tzinfo

from sqlalchemy import ColumnElement, and_

from app.models import Task
from app.utils.dates import as_aware_utc, as_naive_utc, get_zone, utc_now

RANGED_VIEWS = ("today", "upcoming", "week", "month")
COUNTED_VIEWS = ("inbox", "overdue", *RANGED_VIEWS)
TASK_VIEWS = (*COUNTED_VIEWS, "all")
UPCOMING_DAYS = 14

Window = tuple[datetime, datetime]


def _local_day(now: datetime, zone: tzinfo) -> date:
    return as_aware_utc(now).astimezone(zone).date()


def _first_of_next_month(day: date) -> date:
    return (day.replace(day=1) + timedelta(days=32)).replace(day=1)


def _days_of(view: str, today: date) -> tuple[date, date]:
    """First day (inclusive) and the day after the last one."""
    if view == "today":
        return today, today + timedelta(days=1)
    if view == "upcoming":
        tomorrow = today + timedelta(days=1)
        return tomorrow, tomorrow + timedelta(days=UPCOMING_DAYS)
    if view == "week":
        monday = today - timedelta(days=today.weekday())
        return monday, monday + timedelta(days=7)
    return today.replace(day=1), _first_of_next_month(today)


def _midnight_utc(day: date, zone: tzinfo) -> datetime:
    return as_naive_utc(datetime.combine(day, time.min, tzinfo=zone))


def view_window(
    view: str | None, zone_name: str | None, now: datetime | None = None
) -> Window | None:
    """The [start, end) span of a ranged view as naive UTC, else None."""
    if view not in RANGED_VIEWS:
        return None
    zone = get_zone(zone_name)
    first, after_last = _days_of(view, _local_day(now or utc_now(), zone))
    return _midnight_utc(first, zone), _midnight_utc(after_last, zone)


def view_clause(
    view: str | None, zone_name: str | None, now: datetime | None = None
) -> ColumnElement[bool] | None:
    if view == "inbox":
        return Task.project_id.is_(None)
    if view == "overdue":
        return and_(Task.is_completed.is_(False), Task.end_at < (now or utc_now()))
    if window := view_window(view, zone_name, now):
        start, end = window
        return and_(Task.end_at >= start, Task.end_at < end)
    return None
