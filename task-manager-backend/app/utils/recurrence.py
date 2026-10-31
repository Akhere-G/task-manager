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
from datetime import date, datetime, timedelta

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
    return datetime.combine(day, local.timetz().replace(tzinfo=None), tzinfo=tz)


def _is_int(value, low, high):
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def is_valid_month_day(text):
    if not isinstance(text, str) or len(text) != 5 or text[2] != "-":
        return False
    try:
        month, day = map(int, text.split("-"))
        return 1 <= day <= monthrange(LEAP_YEAR, month)[1]
    except ValueError:
        return False


_DAY_VALIDATORS = {
    "weekly": lambda day: _is_int(day, 0, 6),
    "monthly": lambda day: _is_int(day, 1, 31),
    "yearly": is_valid_month_day,
}


def is_valid_day(repeat_by, day):
    return _DAY_VALIDATORS[repeat_by](day) if repeat_by in _DAY_VALIDATORS else False


def normalise_days(repeat_by, days):
    """Sorted, de-duplicated, in-range days for the frequency. Empty list if none."""
    return sorted({d for d in days or [] if is_valid_day(repeat_by, d)})


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


def _days_for(start, repeat_by, days, tz):
    return normalise_days(repeat_by, days) or default_days(start, repeat_by, tz) or []


# A "period" is the cycle the chosen days sit in, named by its first day: the Monday
# of a week, the 1st of a month or 1 January. Intervals count periods.


def _period_start(repeat_by, day):
    if repeat_by == "weekly":
        return day - timedelta(days=day.weekday())
    if repeat_by == "monthly":
        return day.replace(day=1)
    return day.replace(month=1, day=1)


def _shift_period(repeat_by, start, count):
    if repeat_by == "weekly":
        return start + timedelta(weeks=count)
    if repeat_by == "monthly":
        years, month0 = divmod(start.year * 12 + start.month - 1 + count, 12)
        return date(years, month0 + 1, 1)
    return date(start.year + count, 1, 1)


def _slots(repeat_by, period, days):
    """The chosen days of one period as sorted dates, clamped to the month's length."""
    if repeat_by == "weekly":
        slots = {period + timedelta(days=d) for d in days}
    elif repeat_by == "monthly":
        last = monthrange(period.year, period.month)[1]
        slots = {period.replace(day=min(d, last)) for d in days}
    else:
        slots = set()
        for text in days:
            month, day = map(int, text.split("-"))
            slots.add(date(period.year, month, min(day, monthrange(period.year, month)[1])))
    return sorted(slots)


def _step(start, repeat_by, interval, days, tz, direction):
    """The occurrence after (`direction` 1) or before (-1) `start`, keeping its local time."""
    interval = max(int(interval or 1), 1)
    local = _to_local(start, tz)
    today = local.date()

    if repeat_by in _DAY_VALIDATORS:
        chosen = _days_for(start, repeat_by, days, tz)
        period = _period_start(repeat_by, today)
        slots = [
            d
            for d in _slots(repeat_by, period, chosen)
            if (d - today) * direction > timedelta(0)
        ]
        if not slots:
            other = _shift_period(repeat_by, period, interval * direction)
            slots = _slots(repeat_by, other, chosen)
        day = slots[0] if direction > 0 else slots[-1]
    else:
        day = today + timedelta(days=interval * direction)

    return _from_local(_at(day, local, tz), start)


def next_occurrence(start, repeat_by, interval, days, tz=UTC):
    """The occurrence after `start`, keeping its local time of day."""
    return _step(start, repeat_by, interval, days, tz, 1)


def previous_occurrence(start, repeat_by, interval, days, tz=UTC):
    """The occurrence before `start`, keeping its local time of day."""
    return _step(start, repeat_by, interval, days, tz, -1)


def snap_to_slot(start, repeat_by, interval, days, tz=UTC):
    """`start` if it is on a chosen day, otherwise the next chosen day after it."""
    if repeat_by not in _DAY_VALIDATORS:
        return start
    chosen = _days_for(start, repeat_by, days, tz)
    today = _to_local(start, tz).date()
    if today in _slots(repeat_by, _period_start(repeat_by, today), chosen):
        return start
    return next_occurrence(start, repeat_by, interval, chosen, tz)
