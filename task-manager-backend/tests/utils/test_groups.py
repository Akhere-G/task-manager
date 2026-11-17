from datetime import datetime

import pytest

from app.utils.groups import TASK_GROUPS, group_clause, start_of_tomorrow

NOW = datetime(2026, 3, 11, 22, 30)


def test_tomorrow_starts_at_the_next_local_midnight_in_utc() -> None:
    assert start_of_tomorrow("UTC", NOW) == datetime(2026, 3, 12)


def test_the_viewers_zone_moves_the_boundary() -> None:
    assert start_of_tomorrow("Asia/Tokyo", NOW) == datetime(2026, 3, 12, 15)
    assert start_of_tomorrow("America/Los_Angeles", NOW) == datetime(2026, 3, 12, 7)


def test_no_group_means_no_clause() -> None:
    assert group_clause(None, "UTC") is None


@pytest.mark.parametrize("group", TASK_GROUPS)
def test_every_group_has_a_clause(group: str) -> None:
    assert group_clause(group, "UTC", NOW) is not None
