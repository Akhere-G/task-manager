"""Recurrence maths for repeating tasks.

A repeating task has a frequency (`repeat_by`), an interval ("every N units") and
the days picked inside one cycle:

- weekly: weekdays, Monday=0 .. Sunday=6
- monthly: days of the month, 1..31 (clamped to the month's length)
- yearly: "MM-DD" strings (Feb 29 is clamped to Feb 28 in non-leap years)
- daily: no days, just the interval

All calendar maths happens on the local wall-clock date and time in the task's
time zone, then the result is converted back to UTC. Naive datetimes are treated
as UTC and returned naive; aware datetimes are returned as aware UTC.
"""

from calendar import monthrange
from datetime import datetime, timedelta

from app.utils.dates import UTC

LEAP_YEAR = 2024


def _to_local(value, tz):
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(tz)


def _from_local(local, like):
    utc = local.astimezone(UTC)
    return utc if like.tzinfo is not None else utc.replace(tzinfo=None)


def _at(day, local, tz):
    """`day` at the wall-clock time of `local`, in `tz`."""
    return datetime(
        day.year,
        day.month,
        day.day,
        local.hour,
        local.minute,
        local.second,
        local.microsecond,
        tzinfo=tz,
    )


def _parse_month_day(text):
    month, day = text.split("-")
    return int(month), int(day)


def is_valid_month_day(text):
    if not isinstance(text, str) or len(text) != 5 or text[2] != "-":
        return False
    try:
        month, day = _parse_month_day(text)
        return 1 <= day <= monthrange(LEAP_YEAR, month)[1]
    except ValueError:
        return False


def normalise_days(repeat_by, days):
    """Sorted, de-duplicated, in-range days for the frequency. Empty list if none."""
    if repeat_by == "weekly":
        valid = {d for d in days or [] if isinstance(d, int) and 0 <= d <= 6}
        return sorted(valid)
    if repeat_by == "monthly":
        valid = {d for d in days or [] if isinstance(d, int) and 1 <= d <= 31}
        return sorted(valid)
    if repeat_by == "yearly":
        return sorted({d for d in days or [] if is_valid_month_day(d)})
    return []


def default_days(start, repeat_by, tz=UTC):
    """The single day matching `start`, so a series keeps its original rhythm."""
    local = _to_local(start, tz)
    if repeat_by == "weekly":
        return [local.weekday()]
    if repeat_by == "monthly":
        return [local.day]
    if repeat_by == "yearly":
        return [f"{local.month:02d}-{local.day:02d}"]
    return None


def _month_slots(days, year, month):
    last = monthrange(year, month)[1]
    return sorted({min(d, last) for d in days})


def _year_slots(days, year):
    slots = set()
    for text in days:
        month, day = _parse_month_day(text)
        slots.add((month, min(day, monthrange(year, month)[1])))
    return sorted(slots)


def _days_for(start, repeat_by, days, tz):
    return normalise_days(repeat_by, days) or default_days(start, repeat_by, tz) or []


def _shift_month(year, month, delta):
    year, month0 = divmod(year * 12 + (month - 1) + delta, 12)
    return year, month0 + 1


def next_occurrence(start, repeat_by, interval, days, tz=UTC):
    """The occurrence after `start`, keeping its local time of day."""
    interval = max(int(interval or 1), 1)
    local = _to_local(start, tz)
    today = local.date()

    if repeat_by == "weekly":
        chosen = _days_for(start, repeat_by, days, tz)
        weekday = local.weekday()
        later = [d for d in chosen if d > weekday]
        if later:
            day = today + timedelta(days=later[0] - weekday)
        else:
            monday = today - timedelta(days=weekday)
            day = monday + timedelta(weeks=interval, days=chosen[0])
    elif repeat_by == "monthly":
        chosen = _days_for(start, repeat_by, days, tz)
        later = [d for d in _month_slots(chosen, today.year, today.month) if d > today.day]
        if later:
            day = today.replace(day=later[0])
        else:
            year, month = _shift_month(today.year, today.month, interval)
            day = today.replace(
                year=year, month=month, day=_month_slots(chosen, year, month)[0]
            )
    elif repeat_by == "yearly":
        chosen = _days_for(start, repeat_by, days, tz)
        later = [s for s in _year_slots(chosen, today.year) if s > (today.month, today.day)]
        if later:
            month, month_day = later[0]
            day = today.replace(month=month, day=month_day)
        else:
            year = today.year + interval
            month, month_day = _year_slots(chosen, year)[0]
            day = today.replace(year=year, month=month, day=month_day)
    else:
        day = today + timedelta(days=interval)

    return _from_local(_at(day, local, tz), start)


def previous_occurrence(start, repeat_by, interval, days, tz=UTC):
    """The occurrence before `start`, keeping its local time of day."""
    interval = max(int(interval or 1), 1)
    local = _to_local(start, tz)
    today = local.date()

    if repeat_by == "weekly":
        chosen = _days_for(start, repeat_by, days, tz)
        weekday = local.weekday()
        earlier = [d for d in chosen if d < weekday]
        if earlier:
            day = today - timedelta(days=weekday - earlier[-1])
        else:
            monday = today - timedelta(days=weekday)
            day = monday - timedelta(weeks=interval) + timedelta(days=chosen[-1])
    elif repeat_by == "monthly":
        chosen = _days_for(start, repeat_by, days, tz)
        earlier = [d for d in _month_slots(chosen, today.year, today.month) if d < today.day]
        if earlier:
            day = today.replace(day=earlier[-1])
        else:
            year, month = _shift_month(today.year, today.month, -interval)
            day = today.replace(
                year=year, month=month, day=_month_slots(chosen, year, month)[-1]
            )
    elif repeat_by == "yearly":
        chosen = _days_for(start, repeat_by, days, tz)
        earlier = [s for s in _year_slots(chosen, today.year) if s < (today.month, today.day)]
        if earlier:
            month, month_day = earlier[-1]
            day = today.replace(month=month, day=month_day)
        else:
            year = today.year - interval
            month, month_day = _year_slots(chosen, year)[-1]
            day = today.replace(year=year, month=month, day=month_day)
    else:
        day = today - timedelta(days=interval)

    return _from_local(_at(day, local, tz), start)


def _on_slot(start, repeat_by, days, tz):
    local = _to_local(start, tz)
    if repeat_by == "weekly":
        return local.weekday() in days
    if repeat_by == "monthly":
        return local.day in _month_slots(days, local.year, local.month)
    if repeat_by == "yearly":
        return (local.month, local.day) in _year_slots(days, local.year)
    return True


def snap_to_slot(start, repeat_by, interval, days, tz=UTC):
    """`start` if it is on a chosen day, otherwise the next chosen day after it."""
    chosen = _days_for(start, repeat_by, days, tz)
    if repeat_by == "daily" or _on_slot(start, repeat_by, chosen, tz):
        return start
    return next_occurrence(start, repeat_by, interval, chosen, tz)
