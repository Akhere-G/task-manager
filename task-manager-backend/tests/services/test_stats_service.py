import time
from datetime import datetime, timedelta, timezone

import pytest

from app.database import db
from app.models import Task
from app.services import stats_service
from app.services.stats_service import get_all_dashboard_stats, get_brief_stats


@pytest.fixture
def user_id(app, make_user):
    with app.app_context():
        yield make_user()


@pytest.fixture
def new_york_server_time(monkeypatch):
    monkeypatch.setenv("TZ", "America/New_York")
    time.tzset()
    yield
    monkeypatch.undo()
    time.tzset()


def naive_utc(delta):
    return (datetime.now(timezone.utc) + delta).replace(microsecond=0, tzinfo=None)


def add_task(user_id, **fields):
    end = fields.pop("end_at", naive_utc(timedelta(hours=1)))
    start = fields.pop("start_at", None)
    duration = fields.pop("duration", 60)
    task = Task(
        user_id=user_id,
        title="Task",
        category=fields.pop("category", "work"),
        start_at=start or end - timedelta(minutes=duration),
        end_at=end,
        **fields,
    )
    db.session.add(task)
    db.session.commit()
    return task


def test_estimate_timestamp_is_utc_whatever_the_server_time_zone(user_id, new_york_server_time):
    end = naive_utc(timedelta(days=-2))
    add_task(user_id, end_at=end, is_completed=True, completed_at=end + timedelta(minutes=30))

    entry = get_all_dashboard_stats(user_id)["estimationAccuracy"][0]

    assert entry["estimated_at"] == int(end.replace(tzinfo=timezone.utc).timestamp())


def test_backlog_and_category_volume_only_count_the_users_own_tasks(user_id, make_user):
    other = make_user("other@example.com")
    add_task(user_id, category="work")
    add_task(user_id, category="home")
    add_task(other, category="work")

    volume = {row["category"]: row for row in get_all_dashboard_stats(user_id)["categoryVolume"]}

    assert volume["work"]["pending"] == 1
    assert volume["home"]["pending"] == 1


def test_brief_stats_are_the_subset_the_brief_uses(user_id):
    add_task(user_id)
    brief = get_brief_stats(user_id)
    full = get_all_dashboard_stats(user_id)
    assert set(brief) == {"productivity", "categoryVolume"}
    assert brief["productivity"] == full["productivity"]


NOW = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def frozen_now(monkeypatch):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW if tz else NOW.replace(tzinfo=None)

    monkeypatch.setattr(stats_service, "datetime", FrozenDatetime)


def finished(user_id, days_ago, minutes=60, **fields):
    completed = (NOW - timedelta(days=days_ago)).replace(tzinfo=None)
    return add_task(
        user_id,
        end_at=completed - timedelta(minutes=5),
        start_at=None,
        duration=minutes,
        is_completed=True,
        completed_at=completed,
        **fields,
    )


def test_time_spent_sums_completed_minutes_per_category_largest_first(
    user_id, make_user, frozen_now
):
    other = make_user("other@example.com")
    finished(user_id, 1, minutes=60, category="work")
    finished(user_id, 3, minutes=45, category="work")
    finished(user_id, 2, minutes=30, category="home")
    add_task(user_id, category="learning")
    finished(other, 1, minutes=500, category="work")

    spent = get_all_dashboard_stats(user_id)["timeSpent"]

    assert spent == [
        {"category": "work", "time_spent": 105},
        {"category": "home", "time_spent": 30},
    ]


def test_distribution_trend_counts_the_last_seven_days_by_category(
    user_id, frozen_now
):
    finished(user_id, 0, category="work")
    finished(user_id, 0, category="work")
    finished(user_id, 0, category="health")
    finished(user_id, 6, category="home")
    finished(user_id, 7, category="work")
    add_task(user_id, category="work")

    trend = get_all_dashboard_stats(user_id)["distributionTrend"]

    assert [row["date"] for row in trend] == [f"2026-03-{d:02d}" for d in range(5, 12)]
    today, oldest = trend[-1], trend[0]
    assert (today["work"], today["health"], today["home"]) == (2, 1, 0)
    assert oldest["home"] == 1 and oldest["work"] == 0
    assert sum(sum(v for k, v in row.items() if k != "date") for row in trend) == 4


def test_productivity_reports_tasks_and_minutes_per_day(user_id, frozen_now):
    finished(user_id, 1, minutes=30)
    finished(user_id, 1, minutes=90)
    finished(user_id, 4, minutes=15)

    days = {d["date"]: d for d in get_all_dashboard_stats(user_id)["productivity"]}

    assert len(days) == 366 and max(days) == "2026-03-11"
    assert days["2026-03-10"] == {"date": "2026-03-10", "tasks": 2, "time_spent": 120}
    assert days["2026-03-07"]["tasks"] == 1 and days["2026-03-07"]["time_spent"] == 15
    assert days["2026-03-11"]["tasks"] == 0


def test_week_overview_totals_pending_work_for_the_next_seven_days(user_id, frozen_now):
    add_task(user_id, end_at=datetime(2026, 3, 12, 10, 0), duration=60)
    add_task(user_id, end_at=datetime(2026, 3, 12, 16, 0), duration=30)
    add_task(user_id, end_at=datetime(2026, 3, 14, 10, 0), duration=120)
    add_task(user_id, end_at=datetime(2026, 3, 12, 11, 0), duration=600, is_completed=True)
    add_task(user_id, end_at=datetime(2026, 3, 25, 10, 0), duration=60)

    overview = get_all_dashboard_stats(user_id)["weekOverview"]

    assert overview == [
        {"date": "2026-03-12", "totalMinutes": 90, "total_hours": "1.50", "count": 2},
        {"date": "2026-03-14", "totalMinutes": 120, "total_hours": "2.00", "count": 1},
    ]


def test_dashboard_has_every_chart_even_with_no_tasks(user_id, frozen_now):
    stats = get_all_dashboard_stats(user_id)

    assert set(stats) == {
        "productivity", "timeSpent", "backlogHealth", "categoryVolume",
        "overdueDistribution", "deadlineProximity", "hourlyProductivity",
        "turnaround", "estimationAccuracy", "weekOverview", "distributionTrend",
    }
    assert stats["timeSpent"] == [] and stats["weekOverview"] == []
    assert len(stats["productivity"]) == 366 and len(stats["distributionTrend"]) == 7


@pytest.mark.xfail(
    strict=True,
    reason="ghosts copy the head's completed state, so one completed head is counted "
    "once per projected day (stats_service.py:286-298, task_utils.py:132-148)",
)
def test_a_completed_repeating_head_is_counted_once(user_id, frozen_now):
    completed = (NOW - timedelta(days=1)).replace(tzinfo=None)
    add_task(
        user_id,
        end_at=completed,
        is_completed=True,
        completed_at=completed,
        is_repeating=True,
        repeat_by="daily",
    )

    days = {d["date"]: d for d in get_all_dashboard_stats(user_id)["productivity"]}

    assert days["2026-03-10"]["tasks"] == 1
