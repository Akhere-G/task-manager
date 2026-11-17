"""List groups: disjoint buckets of tasks, split at the viewer's now and tomorrow."""

from datetime import datetime, time, timedelta

from sqlalchemy import ColumnElement, and_

from app.models import Task
from app.utils.dates import as_aware_utc, as_naive_utc, get_zone, utc_now

TASK_GROUPS = ("overdue", "today", "upcoming", "undated", "completed")


def start_of_tomorrow(zone_name: str | None, now: datetime) -> datetime:
    zone = get_zone(zone_name)
    local_today = as_aware_utc(now).astimezone(zone).date()
    local_tomorrow = local_today + timedelta(days=1)
    return as_naive_utc(datetime.combine(local_tomorrow, time.min, tzinfo=zone))


def group_clause(
    group: str | None, zone_name: str | None, now: datetime | None = None
) -> ColumnElement[bool] | None:
    if group is None:
        return None
    now = now or utc_now()
    is_open = Task.is_completed.is_(False)
    tomorrow = start_of_tomorrow(zone_name, now)
    if group == "overdue":
        return and_(is_open, Task.end_at < now)
    if group == "today":
        return and_(is_open, Task.end_at >= now, Task.end_at < tomorrow)
    if group == "upcoming":
        return and_(is_open, Task.end_at >= tomorrow)
    if group == "undated":
        return and_(is_open, Task.end_at.is_(None))
    return Task.is_completed.is_(True)
