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

A "period" is the cycle the chosen days sit in, named by its first day: the Monday
of a week, the 1st of a month or 1 January. Intervals count periods.
"""

from calendar import monthrange
from datetime import UTC, date, datetime, timedelta

LEAP_YEAR = 2024
FORWARD = 1
BACKWARD = -1


def _to_local(value, zone):
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(zone)


def _from_local(local, like):
    utc = local.astimezone(UTC)
    return utc if like.tzinfo is not None else utc.replace(tzinfo=None)


def _at_time_of(day, local, zone):
    return datetime.combine(day, local.timetz().replace(tzinfo=None), tzinfo=zone)


def _is_int_between(value, low, high):
    if not isinstance(value, int) or isinstance(value, bool):
        return False
    return low <= value <= high


def _days_in_month(year, month):
    return monthrange(year, month)[1]


def _parse_month_day(text):
    month, day = map(int, text.split("-"))
    return month, day


def is_valid_month_day(text):
    if not isinstance(text, str) or len(text) != 5 or text[2] != "-":
        return False
    try:
        month, day = _parse_month_day(text)
        return 1 <= day <= _days_in_month(LEAP_YEAR, month)
    except ValueError:
        return False


_DAY_VALIDATORS = {
    "weekly": lambda day: _is_int_between(day, 0, 6),
    "monthly": lambda day: _is_int_between(day, 1, 31),
    "yearly": is_valid_month_day,
}


def is_valid_day(repeat_by, day):
    validator = _DAY_VALIDATORS.get(repeat_by)
    return validator is not None and validator(day)


def normalise_days(repeat_by, days):
    valid_days = {day for day in days or [] if is_valid_day(repeat_by, day)}
    return sorted(valid_days)


def default_days(start, repeat_by, zone=UTC):
    local = _to_local(start, zone)
    if repeat_by == "weekly":
        return [local.weekday()]
    if repeat_by == "monthly":
        return [local.day]
    if repeat_by == "yearly":
        return [f"{local.month:02d}-{local.day:02d}"]
    return None


def _chosen_days(start, repeat_by, days, zone):
    return normalise_days(repeat_by, days) or default_days(start, repeat_by, zone) or []


def _period_start(repeat_by, day):
    if repeat_by == "weekly":
        return day - timedelta(days=day.weekday())
    if repeat_by == "monthly":
        return day.replace(day=1)
    return day.replace(month=1, day=1)


def _shift_period(repeat_by, period, count):
    if repeat_by == "weekly":
        return period + timedelta(weeks=count)
    if repeat_by == "monthly":
        year, month_index = divmod(period.year * 12 + period.month - 1 + count, 12)
        return date(year, month_index + 1, 1)
    return date(period.year + count, 1, 1)


def _slots(repeat_by, period, days):
    slots = set()
    for day in days:
        if repeat_by == "weekly":
            slots.add(period + timedelta(days=day))
        elif repeat_by == "monthly":
            last_day = _days_in_month(period.year, period.month)
            slots.add(period.replace(day=min(day, last_day)))
        else:
            month, month_day = _parse_month_day(day)
            last_day = _days_in_month(period.year, month)
            slots.add(date(period.year, month, min(month_day, last_day)))
    return sorted(slots)


def _step_slot(
    start_day,
    repeat_by,
    interval,
    days,
    direction,
):
    period = _period_start(repeat_by, start_day)
    slots = []
    for slot in _slots(repeat_by, period, days):
        if (slot - start_day) * direction > timedelta(0):
            slots.append(slot)

    if not slots:
        other_period = _shift_period(repeat_by, period, interval * direction)
        slots = _slots(repeat_by, other_period, days)
    return slots[0] if direction == FORWARD else slots[-1]


def _step(
    start,
    repeat_by,
    interval,
    days,
    zone,
    direction,
):
    interval = max(int(interval or 1), 1)
    local = _to_local(start, zone)
    start_day = local.date()

    if repeat_by in _DAY_VALIDATORS:
        chosen = _chosen_days(start, repeat_by, days, zone)
        day = _step_slot(start_day, repeat_by, interval, chosen, direction)
    else:
        day = start_day + timedelta(days=interval * direction)

    return _from_local(_at_time_of(day, local, zone), start)


def next_occurrence(
    start,
    repeat_by,
    interval,
    days,
    zone=UTC,
):
    return _step(start, repeat_by, interval, days, zone, FORWARD)


def previous_occurrence(
    start,
    repeat_by,
    interval,
    days,
    zone=UTC,
):
    return _step(start, repeat_by, interval, days, zone, BACKWARD)


def snap_to_slot(
    start,
    repeat_by,
    interval,
    days,
    zone=UTC,
):
    if repeat_by not in _DAY_VALIDATORS:
        return start
    chosen = _chosen_days(start, repeat_by, days, zone)
    start_day = _to_local(start, zone).date()
    if start_day in _slots(repeat_by, _period_start(repeat_by, start_day), chosen):
        return start
    return next_occurrence(start, repeat_by, interval, chosen, zone)
