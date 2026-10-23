import time
from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


@pytest.fixture
def new_york_server_time(monkeypatch):
    monkeypatch.setenv("TZ", "America/New_York")
    time.tzset()
    yield
    monkeypatch.undo()
    time.tzset()


def fmt(moment):
    return moment.strftime("%Y-%m-%d %H:%M:%S")


def test_estimate_timestamp_is_utc_whatever_the_server_time_zone(
    session, task_payload, new_york_server_time
):
    end = (datetime.now(timezone.utc) - timedelta(days=2)).replace(microsecond=0)
    done = end + timedelta(minutes=30)
    created = session.post(
        "/api/tasks",
        json=task_payload(startAt=fmt(end - timedelta(hours=1)), endAt=fmt(end)),
    )
    assert created.status_code == 201
    updated = session.patch(
        f"/api/tasks/{created.get_json()['id']}",
        json={"isCompleted": True, "completedAt": fmt(done)},
    )
    assert updated.status_code == 200

    stats = session.get("/api/stats/dashboard").get_json()

    entry = stats["estimationAccuracy"][0]
    assert entry["estimatedAt"] == int(end.timestamp())
