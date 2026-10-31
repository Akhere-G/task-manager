from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.utils.recurrence import RepeatDay, at_time_of, replace_slot

LONDON = ZoneInfo("Europe/London")


@pytest.mark.parametrize(
    "repeat_by, days, previous_start, new_start, expected",
    [
        ("weekly", [0], "2026-03-09 09:00", "2026-03-10 09:00", [1]),
        ("weekly", [0, 3], "2026-03-09 09:00", "2026-03-14 09:00", [3, 5]),
        ("weekly", [0, 2], "2026-03-09 09:00", "2026-03-11 09:00", [2]),
        ("monthly", [31], "2026-02-28 09:00", "2026-02-15 09:00", [15]),
        ("monthly", [1, 15], "2026-04-15 09:00", "2026-04-20 09:00", [1, 20]),
        ("yearly", ["02-29"], "2027-02-28 09:00", "2027-03-05 09:00", ["03-05"]),
    ],
)
def test_the_day_moved_from_is_swapped_for_the_day_moved_to(
    repeat_by: str,
    days: list[RepeatDay],
    previous_start: str,
    new_start: str,
    expected: list[RepeatDay],
) -> None:
    moved = replace_slot(
        repeat_by,
        days,
        datetime.fromisoformat(previous_start),
        datetime.fromisoformat(new_start),
    )

    assert moved == expected


def test_days_are_read_in_the_series_zone() -> None:
    late_sunday_utc = datetime(2026, 7, 5, 23, 30)  # 00:30 Monday in London
    tuesday_utc = datetime(2026, 7, 7, 8, 0)

    assert replace_slot("weekly", [0], late_sunday_utc, tuesday_utc, LONDON) == [1]


def test_keeps_the_date_and_takes_the_other_time_of_day() -> None:
    start = datetime(2026, 3, 2, 9, 0)
    other = datetime(2026, 3, 10, 14, 30)

    assert at_time_of(start, other) == datetime(2026, 3, 2, 14, 30)


def test_time_of_day_is_kept_in_local_time_across_a_clock_change() -> None:
    summer_start = datetime(2026, 3, 30, 8, 0)  # 09:00 BST
    winter_other = datetime(2026, 3, 20, 14, 0)  # 14:00 GMT

    moved = at_time_of(summer_start, winter_other, LONDON)

    assert moved == datetime(2026, 3, 30, 13, 0)  # 14:00 BST
