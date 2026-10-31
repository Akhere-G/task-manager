from datetime import date, datetime
from typing import Any

import pytest

from app.utils import task_utils
from app.utils.dates import as_naive_utc
from app.utils.task_utils import with_repeating
from tests.builders import add_task

pytestmark = pytest.mark.integration


def add_daily_task(user_id: int, **overrides: Any) -> None:
    add_task(user_id, repeatBy="daily", **overrides)


def ghost_days(user_id: int, view_start: datetime, view_end: datetime) -> list[date]:
    days = []
    for ghost in with_repeating([], view_start, view_end, user_id):
        days.append(as_naive_utc(ghost.start_at).date())
    return days


def test_the_stored_occurrence_is_not_repeated_as_a_ghost(user_id: int) -> None:
    add_daily_task(user_id)

    days = ghost_days(user_id, datetime(2026, 3, 2), datetime(2026, 3, 3, 23, 59))

    assert days == [date(2026, 3, 3)]


def test_ghosts_stop_after_the_repeat_until_day(user_id: int) -> None:
    add_daily_task(user_id, repeatUntil="2026-03-04")

    days = ghost_days(user_id, datetime(2026, 3, 1), datetime(2026, 3, 10))

    assert days == [date(2026, 3, 3), date(2026, 3, 4)]


def test_ghosts_belong_to_their_series_and_have_stable_ids(user_id: int) -> None:
    add_daily_task(user_id)

    ghosts = with_repeating(
        [], datetime(2026, 3, 3), datetime(2026, 3, 3, 23, 59), user_id
    )

    assert [ghost.id for ghost in ghosts] == [f"ghost_{ghosts[0].series_id}_20260303"]


def test_projection_is_capped(user_id: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(task_utils, "MAX_GHOSTS", 3)
    add_daily_task(user_id)

    days = ghost_days(user_id, datetime(2026, 3, 1), datetime(2026, 3, 31))

    assert len(days) == 3
