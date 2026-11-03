"""Snooze: move a task to a later day, keeping its time of day and length."""

from datetime import date, datetime, time, timedelta, tzinfo

from app.utils.dates import as_aware_utc, as_naive_utc, get_zone, utc_now

DAY_PRESETS = ("tomorrow", "weekend", "next_week", "date")
SNOOZE_PRESETS = (*DAY_PRESETS, "next_occurrence")
UNDATED_START = time(9, 0)
UNDATED_LENGTH = timedelta(minutes=30)
SATURDAY = 5
MONDAY = 0

Span = tuple[datetime, datetime]


def local_day(now: datetime, zone: tzinfo) -> date:
    return as_aware_utc(now).astimezone(zone).date()


def _days_until(weekday: int, today: date, *, strictly_after: bool = True) -> int:
    gap = (weekday - today.weekday()) % 7
    return gap or (7 if strictly_after else 0)


def target_day(preset: str, today: date, day: date | None = None) -> date:
    """The day a preset points at, counted from the viewer's today."""
    if preset == "tomorrow":
        return today + timedelta(days=1)
    if preset == "weekend":
        if today.weekday() == SATURDAY:
            return today + timedelta(days=1)
        return today + timedelta(days=_days_until(SATURDAY, today))
    if preset == "next_week":
        return today + timedelta(days=_days_until(MONDAY, today))
    if day is None:
        raise ValueError("The date preset needs a day.")
    return day


def _local_midnight_utc(day: date, at: time, zone: tzinfo) -> datetime:
    return as_naive_utc(datetime.combine(day, at, tzinfo=zone))


def snoozed_span(
    start: datetime | None,
    end: datetime | None,
    day: date,
    zone_name: str | None,
) -> Span:
    """The task's span moved onto `day`; an undated task gets 09:00 for 30 minutes."""
    zone = get_zone(zone_name)
    if start is None or end is None:
        new_start = _local_midnight_utc(day, UNDATED_START, zone)
        return new_start, new_start + UNDATED_LENGTH
    at = as_aware_utc(start).astimezone(zone).time()
    new_start = _local_midnight_utc(day, at, zone)
    return new_start, new_start + (end - start)


def snooze_today(zone_name: str | None, now: datetime | None = None) -> date:
    return local_day(now or utc_now(), get_zone(zone_name))
