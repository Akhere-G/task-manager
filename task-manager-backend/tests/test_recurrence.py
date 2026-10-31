from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from app.utils.recurrence import (
    default_days,
    next_occurrence,
    normalise_days,
    previous_occurrence,
    snap_to_slot,
)

LONDON = ZoneInfo("Europe/London")


@pytest.mark.parametrize(
    "repeat_by, interval, days, start, expected",
    [
        ("daily", 3, None, "2026-03-02 09:00", "2026-03-05 09:00"),
        ("weekly", 1, [0, 3], "2026-03-02 09:00", "2026-03-05 09:00"),
        ("weekly", 2, [0, 3], "2026-03-05 09:00", "2026-03-16 09:00"),
        ("monthly", 1, [31], "2026-01-31 09:00", "2026-02-28 09:00"),
        ("monthly", 2, [1, 15], "2026-03-15 09:00", "2026-05-01 09:00"),
        ("yearly", 1, ["02-29"], "2027-02-28 09:00", "2028-02-29 09:00"),
        ("yearly", 1, ["02-29"], "2028-02-29 09:00", "2029-02-28 09:00"),
    ],
)
def test_next_then_previous_round_trips(repeat_by, interval, days, start, expected):
    start = datetime.fromisoformat(start)
    expected = datetime.fromisoformat(expected)

    assert next_occurrence(start, repeat_by, interval, days) == expected
    assert previous_occurrence(expected, repeat_by, interval, days) == start


def test_local_time_of_day_survives_a_clock_change():
    before = datetime(2026, 3, 28, 9, 0, tzinfo=timezone.utc)  # 09:00 GMT

    after = next_occurrence(before, "daily", 1, None, LONDON)

    assert after == datetime(2026, 3, 29, 8, 0, tzinfo=timezone.utc)  # 09:00 BST


def test_snap_moves_to_the_next_chosen_day_only_when_needed():
    monday = datetime(2026, 3, 2, 9, 0)
    assert snap_to_slot(monday, "weekly", 1, [0]) == monday
    assert snap_to_slot(monday, "weekly", 1, [2]) == datetime(2026, 3, 4, 9, 0)
    assert snap_to_slot(monday, "daily", 1, None) == monday


def test_day_helpers():
    assert normalise_days("weekly", [3, 3, 9, "x", True]) == [3]
    assert normalise_days("yearly", ["12-25", "02-30", "02-29"]) == ["02-29", "12-25"]
    assert normalise_days("daily", [1]) == []
    assert default_days(datetime(2026, 3, 2, 9, 0), "weekly") == [0]
    assert default_days(datetime(2026, 3, 2, 9, 0), "yearly") == ["03-02"]
