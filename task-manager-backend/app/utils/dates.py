"""The database stores naive UTC datetimes."""

from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from dateutil import parser

ZONE_ERRORS = (KeyError, ValueError, OSError)


def utc_now():
    return datetime.now(UTC).replace(tzinfo=None)


def parse_iso(value):
    return parser.isoparse(value) if isinstance(value, str) else value


def as_naive_utc(value):
    value = parser.isoparse(value) if isinstance(value, str) else value
    if value.tzinfo is not None:
        value = value.astimezone(UTC).replace(tzinfo=None)
    return value


def as_aware_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def start_of_day(day):
    return datetime.combine(day, time.min)


def end_of_day(day):
    return datetime.combine(day, time.max)


def to_iso_z(value):
    if isinstance(value, datetime):
        return as_aware_utc(value).isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    return value


def get_zone(zone_name):
    if not zone_name:
        return UTC
    try:
        return ZoneInfo(zone_name)
    except ZONE_ERRORS:
        return UTC


def is_valid_zone(zone_name):
    if not isinstance(zone_name, str) or not zone_name:
        return False
    try:
        ZoneInfo(zone_name)
    except ZONE_ERRORS:
        return False
    return True


def local_today(zone_name):
    return datetime.now(get_zone(zone_name)).date()
