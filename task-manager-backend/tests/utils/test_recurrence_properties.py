from datetime import date, datetime

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.utils.recurrence import (
    RepeatDay,
    default_days,
    next_occurrence,
    previous_occurrence,
    replace_slot,
    snap_to_slot,
)

pytestmark = pytest.mark.property

starts = st.datetimes(min_value=datetime(2000, 1, 1), max_value=datetime(2099, 12, 31))
intervals = st.integers(min_value=1, max_value=4)
weekly_days = st.lists(st.integers(0, 6), min_size=1, max_size=7, unique=True)
monthly_days = st.lists(st.integers(1, 31), min_size=1, max_size=5, unique=True)
yearly_days = st.lists(
    st.dates(min_value=date(2024, 1, 1), max_value=date(2024, 12, 31)).map(
        lambda day: f"{day:%m-%d}"
    ),
    min_size=1,
    max_size=4,
    unique=True,
)
series = st.one_of(
    st.tuples(st.just("daily"), st.none()),
    st.tuples(st.just("weekly"), weekly_days),
    st.tuples(st.just("monthly"), monthly_days),
    st.tuples(st.just("yearly"), yearly_days),
)


@given(start=starts, interval=intervals, rule=series)
def test_previous_undoes_next(
    start: datetime, interval: int, rule: tuple[str, list[RepeatDay] | None]
) -> None:
    repeat_by, days = rule
    occurrence = snap_to_slot(start, repeat_by, interval, days)

    following = next_occurrence(occurrence, repeat_by, interval, days)

    assert following > occurrence
    assert previous_occurrence(following, repeat_by, interval, days) == occurrence


@given(start=starts, interval=intervals, rule=series)
def test_snapping_never_goes_back_and_is_stable(
    start: datetime, interval: int, rule: tuple[str, list[RepeatDay] | None]
) -> None:
    repeat_by, days = rule

    snapped = snap_to_slot(start, repeat_by, interval, days)

    assert snapped >= start
    assert snap_to_slot(snapped, repeat_by, interval, days) == snapped


@given(days=weekly_days, previous_start=starts, new_start=starts)
def test_moving_a_weekly_occurrence_lands_on_the_new_day(
    days: list[RepeatDay], previous_start: datetime, new_start: datetime
) -> None:
    previous_day = default_days(previous_start, "weekly")[0]
    new_day = default_days(new_start, "weekly")[0]

    moved = replace_slot("weekly", days, previous_start, new_start)

    assert new_day in moved
    assert moved == sorted(set(moved))
    if previous_day != new_day:
        assert previous_day not in moved
