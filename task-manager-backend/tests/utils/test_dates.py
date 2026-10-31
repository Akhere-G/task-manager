from datetime import UTC, date, datetime

from app.utils.dates import (
    as_aware_utc,
    as_naive_utc,
    end_of_day,
    get_zone,
    is_valid_zone,
    local_today,
    to_iso_z,
)


def test_offset_strings_are_stored_as_naive_utc() -> None:
    assert as_naive_utc("2026-03-02T11:00:00+01:00") == datetime(2026, 3, 2, 10, 0)


def test_naive_values_are_read_as_utc() -> None:
    assert as_aware_utc(datetime(2026, 3, 2, 10, 0)) == datetime(
        2026, 3, 2, 10, 0, tzinfo=UTC
    )


def test_datetimes_are_written_with_a_z_and_dates_without_a_time() -> None:
    assert to_iso_z(datetime(2026, 3, 2, 10, 0)) == "2026-03-02T10:00:00Z"
    assert to_iso_z(date(2026, 3, 2)) == "2026-03-02"


def test_end_of_day_includes_the_last_microsecond() -> None:
    assert end_of_day(date(2026, 3, 2)) == datetime(2026, 3, 2, 23, 59, 59, 999999)


def test_unknown_or_missing_zones_fall_back_to_utc() -> None:
    assert get_zone("Not/AZone") is UTC
    assert get_zone(None) is UTC
    assert local_today("Not/AZone") == local_today(None)


def test_only_real_zone_names_are_valid() -> None:
    assert is_valid_zone("Europe/London")
    assert not is_valid_zone("Nope")
    assert not is_valid_zone("")
    assert not is_valid_zone(3)
