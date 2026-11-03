from datetime import date, datetime, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.utils.snooze import snoozed_span, target_day

ZONES = ["UTC", "Europe/London", "America/New_York", "Pacific/Auckland"]
days = st.dates(min_value=date(2024, 1, 1), max_value=date(2030, 1, 1))


@given(today=days, preset=st.sampled_from(["tomorrow", "weekend", "next_week"]))
def test_a_preset_always_lands_after_today(today: date, preset: str) -> None:
    assert target_day(preset, today) > today


@given(today=days)
def test_the_weekend_is_a_saturday_or_sunday(today: date) -> None:
    assert target_day("weekend", today).weekday() in (5, 6)


@given(today=days)
def test_next_week_is_a_monday_within_a_week(today: date) -> None:
    result = target_day("next_week", today)

    assert result.weekday() == 0
    assert today < result <= today + timedelta(days=7)


def test_saturday_snoozes_to_sunday() -> None:
    assert target_day("weekend", date(2026, 3, 14)) == date(2026, 3, 15)


def test_a_date_preset_needs_a_day() -> None:
    with pytest.raises(ValueError):
        target_day("date", date(2026, 3, 11))


@given(
    start=st.datetimes(min_value=datetime(2024, 1, 1), max_value=datetime(2029, 1, 1)),
    minutes=st.integers(min_value=1, max_value=600),
    zone=st.sampled_from(ZONES),
)
def test_the_length_is_kept(start: datetime, minutes: int, zone: str) -> None:
    end = start + timedelta(minutes=minutes)

    new_start, new_end = snoozed_span(start, end, date(2026, 6, 1), zone)

    assert new_end - new_start == timedelta(minutes=minutes)


def test_the_local_time_of_day_is_kept_across_a_clock_change() -> None:
    start = datetime(2026, 3, 20, 9, 0)  # 09:00 in London (GMT)
    end = start + timedelta(hours=1)

    new_start, _ = snoozed_span(start, end, date(2026, 4, 1), "Europe/London")

    assert new_start == datetime(2026, 4, 1, 8, 0)  # 09:00 BST


def test_an_undated_task_gets_nine_for_thirty_minutes() -> None:
    new_start, new_end = snoozed_span(None, None, date(2026, 3, 12), "UTC")

    assert new_start == datetime(2026, 3, 12, 9, 0)
    assert new_end - new_start == timedelta(minutes=30)
