"""Reminder fire times and push wording."""

from datetime import datetime, time, timedelta

from app.utils.dates import as_aware_utc, as_naive_utc, get_zone

REMINDER_KINDS = ("before", "clock")
DEFAULT_MINUTES_BEFORE = 30


def fire_time(
    start_at: datetime,
    kind: str,
    minutes_before: int | None,
    days_before: int | None,
    time_of_day: time | None,
    zone_name: str | None,
) -> datetime:
    """When a reminder is due, as naive UTC, for a task that starts at `start_at`."""
    if kind == "before" or time_of_day is None:
        return start_at - timedelta(minutes=minutes_before or 0)
    zone = get_zone(zone_name)
    day = as_aware_utc(start_at).astimezone(zone).date()
    day -= timedelta(days=days_before or 0)
    return as_naive_utc(datetime.combine(day, time_of_day, tzinfo=zone))


def reminder_title(
    title: str,
    kind: str,
    start_at: datetime,
    now: datetime,
    zone_name: str | None,
) -> str:
    if kind == "clock":
        local = as_aware_utc(start_at).astimezone(get_zone(zone_name))
        return f"{title} starts at {local:%H:%M}"
    minutes = max(0, int((start_at - now).total_seconds() // 60))
    suffix = "" if minutes == 1 else "s"
    return f"{title} starting in {minutes} minute{suffix}!"
