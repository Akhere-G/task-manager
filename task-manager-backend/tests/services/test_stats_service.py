import pytest

from app.services.stats_service import StatsContext, productivity_trend
from app.utils.dates import utc_now

pytestmark = pytest.mark.integration


def test_productivity_trend_covers_the_requested_days_ending_today(
    user_id: int,
) -> None:
    trend = productivity_trend(StatsContext(user_id), days=7)

    assert len(trend) == 7
    assert trend[-1]["date"] == utc_now().date().isoformat()


def test_productivity_trend_defaults_to_a_year(user_id: int) -> None:
    assert len(productivity_trend(StatsContext(user_id))) == 366


def test_context_computes_names_once(user_id: int) -> None:
    ctx = StatsContext(user_id)

    assert ctx.names is ctx.names
    assert ctx.ghosts is ctx.ghosts
