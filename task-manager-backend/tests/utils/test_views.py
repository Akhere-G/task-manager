from datetime import datetime, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.utils.views import RANGED_VIEWS, view_window

ZONES = ["UTC", "Europe/London", "America/New_York", "Pacific/Auckland"]
instants = st.datetimes(min_value=datetime(2024, 1, 1), max_value=datetime(2030, 1, 1))


def window(view: str, zone: str, now: datetime) -> tuple[datetime, datetime]:
    result = view_window(view, zone, now)
    assert result is not None
    return result


@given(now=instants, zone=st.sampled_from(ZONES), view=st.sampled_from(RANGED_VIEWS))
def test_a_ranged_view_always_contains_now_unless_it_starts_tomorrow(
    now: datetime, zone: str, view: str
) -> None:
    start, end = window(view, zone, now)

    assert start < end
    if view != "upcoming":
        assert start <= now < end


def test_today_follows_the_viewers_local_day() -> None:
    now = datetime(2026, 3, 2, 23, 30)

    start, end = window("today", "Pacific/Auckland", now)

    assert start == datetime(2026, 3, 2, 11, 0)
    assert end - start == timedelta(hours=24)


def test_the_week_runs_monday_to_sunday() -> None:
    start, end = window("week", "UTC", datetime(2026, 3, 5, 12))

    assert (start, end) == (datetime(2026, 3, 2), datetime(2026, 3, 9))


def test_the_month_is_the_calendar_month() -> None:
    start, end = window("month", "UTC", datetime(2026, 12, 15))

    assert (start, end) == (datetime(2026, 12, 1), datetime(2027, 1, 1))


def test_upcoming_is_tomorrow_through_the_next_fourteen_days() -> None:
    start, end = window("upcoming", "UTC", datetime(2026, 3, 2, 8))

    assert (start, end) == (datetime(2026, 3, 3), datetime(2026, 3, 17))


@pytest.mark.parametrize(
    ("day", "hours"),
    [(datetime(2026, 3, 29, 12), 23), (datetime(2026, 10, 25, 12), 25)],
)
def test_a_day_is_23_or_25_hours_across_the_clock_change(
    day: datetime, hours: int
) -> None:
    start, end = window("today", "Europe/London", day)

    assert end - start == timedelta(hours=hours)


@pytest.mark.parametrize("view", [None, "all", "inbox", "overdue"])
def test_other_views_have_no_window(view: str | None) -> None:
    assert view_window(view, "UTC") is None
