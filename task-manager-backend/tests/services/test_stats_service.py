import time
from datetime import datetime, timedelta, timezone

import pytest

from app.database import db
from app.models import Task
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
    task = Task(
        user_id=user_id,
        title="Task",
        category=fields.pop("category", "work"),
        start_at=end - timedelta(hours=1),
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
