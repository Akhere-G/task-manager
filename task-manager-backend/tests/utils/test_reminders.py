from datetime import datetime, time, timedelta

from hypothesis import given
from hypothesis import strategies as st

from app.utils.reminders import fire_time, reminder_title

starts = st.datetimes(min_value=datetime(2024, 1, 1), max_value=datetime(2029, 1, 1))


@given(start=starts, minutes=st.integers(min_value=0, max_value=1440))
def test_a_before_reminder_fires_that_many_minutes_ahead(
    start: datetime, minutes: int
) -> None:
    fired = fire_time(start, "before", minutes, None, None, None)

    assert start - fired == timedelta(minutes=minutes)


def test_a_clock_reminder_fires_at_that_local_time_on_the_start_day() -> None:
    start = datetime(2026, 3, 11, 14, 0)

    fired = fire_time(start, "clock", None, 0, time(9, 0), "America/New_York")

    assert fired == datetime(2026, 3, 11, 13, 0)  # 09:00 EDT


def test_a_clock_reminder_follows_a_clock_change() -> None:
    before = fire_time(
        datetime(2026, 3, 6, 20, 0), "clock", None, 0, time(9, 0), "America/New_York"
    )
    after = fire_time(
        datetime(2026, 3, 11, 20, 0), "clock", None, 0, time(9, 0), "America/New_York"
    )

    assert before == datetime(2026, 3, 6, 14, 0)  # 09:00 EST
    assert after == datetime(2026, 3, 11, 13, 0)  # 09:00 EDT


def test_days_before_moves_a_clock_reminder_to_an_earlier_day() -> None:
    start = datetime(2026, 3, 11, 15, 0)

    fired = fire_time(start, "clock", None, 1, time(18, 0), "UTC")

    assert fired == datetime(2026, 3, 10, 18, 0)


def test_titles_say_how_long_or_when() -> None:
    start = datetime(2026, 3, 11, 15, 0)
    now = start - timedelta(minutes=30)

    assert reminder_title("Standup", "before", start, now, None) == (
        "Standup starting in 30 minutes!"
    )
    assert reminder_title("Standup", "clock", start, now, "UTC") == (
        "Standup starts at 15:00"
    )
