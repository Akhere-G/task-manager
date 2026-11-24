from datetime import UTC, datetime, timedelta

from app.utils.dates import (
    as_aware_utc,
    as_naive_utc,
    get_zone,
    is_valid_zone,
    local_day_bounds,
    local_today,
)


def test_offset_strings_are_stored_as_naive_utc() -> None:
    assert as_naive_utc("2026-03-02T11:00:00+01:00") == datetime(2026, 3, 2, 10, 0)


def test_naive_values_are_read_as_utc() -> None:
    assert as_aware_utc(datetime(2026, 3, 2, 10, 0)) == datetime(
        2026, 3, 2, 10, 0, tzinfo=UTC
    )


def test_unknown_or_missing_zones_fall_back_to_utc() -> None:
    assert get_zone("Not/AZone") is UTC
    assert get_zone(None) is UTC
    assert local_today("Not/AZone") == local_today(None)


def test_only_real_zone_names_are_valid() -> None:
    assert is_valid_zone("Europe/London")
    assert not is_valid_zone("Nope")
    assert not is_valid_zone("")
    assert not is_valid_zone(3)


def test_a_local_day_runs_from_local_midnight_to_the_next() -> None:
    start, end = local_day_bounds("Pacific/Kiritimati")

    assert end - start == timedelta(days=1)
    assert start.hour == 10
