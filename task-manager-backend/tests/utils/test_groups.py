from datetime import datetime

import pytest

from app.utils.groups import start_of_tomorrow

NOW = datetime(2026, 3, 11, 22, 30)


@pytest.mark.parametrize(
    "zone, expected",
    [
        ("UTC", datetime(2026, 3, 12)),
        ("Asia/Tokyo", datetime(2026, 3, 12, 15)),
        ("America/Los_Angeles", datetime(2026, 3, 12, 7)),
    ],
)
def test_tomorrow_starts_at_the_viewers_next_local_midnight_in_utc(
    zone: str, expected: datetime
) -> None:
    assert start_of_tomorrow(zone, NOW) == expected
