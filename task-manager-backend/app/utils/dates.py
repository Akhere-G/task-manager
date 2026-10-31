"""Date and time helpers shared across the backend.

The database stores naive UTC datetimes, so most helpers convert between that and
timezone-aware values.
"""

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from dateutil import parser

UTC = timezone.utc


def utc_now():
    """The current time as a naive UTC datetime, the way the database stores it."""
    return datetime.now(UTC).replace(tzinfo=None)


def parse_iso(value):
    """A datetime from an ISO string; datetimes and None pass through."""
    return parser.isoparse(value) if isinstance(value, str) else value


def as_naive_utc(value):
    """A naive UTC datetime from an ISO string or any datetime."""
    value = parse_iso(value)
    if value.tzinfo is not None:
        value = value.astimezone(UTC).replace(tzinfo=None)
    return value


def as_aware_utc(value):
    """An aware UTC datetime; naive values are taken to be UTC already."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def start_of_day(day):
    return datetime.combine(day, time.min)


def end_of_day(day):
    return datetime.combine(day, time.max)


def to_iso_z(value):
    """ISO 8601 in UTC with a trailing Z for datetimes; plain ISO for dates."""
    if isinstance(value, datetime):
        return as_aware_utc(value).isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    return value


def get_zone(name):
    """The zone for an IANA name, or UTC when it is missing or unknown."""
    if not name:
        return UTC
    try:
        return ZoneInfo(name)
    except (KeyError, ValueError, OSError):
        return UTC


def is_valid_zone(name):
    if not isinstance(name, str) or not name:
        return False
    try:
        ZoneInfo(name)
    except (KeyError, ValueError, OSError):
        return False
    return True


def local_today(zone_name):
    return datetime.now(get_zone(zone_name)).date()
