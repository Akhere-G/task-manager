import time
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture
def new_york_server_time(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("TZ", "America/New_York")
    time.tzset()
    yield
    monkeypatch.undo()
    time.tzset()


def fmt(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d %H:%M:%S")


def test_estimate_timestamp_is_utc_whatever_the_server_time_zone(
    session: FlaskClient,
    task_payload: Callable[..., dict[str, Any]],
    new_york_server_time: None,
) -> None:
    end = (datetime.now(UTC) - timedelta(days=2)).replace(microsecond=0)
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


@pytest.fixture
def add_tasks(app: Flask, make_user: Callable[..., int]) -> Callable[..., None]:
    user_id = make_user("stats@example.com")

    def add(**fields: Any) -> None:
        with app.app_context():
            from app.database import db
            from app.models import Task

            db.session.add(Task(user_id=user_id, **fields))
            db.session.commit()

    return add


def dashboard(app: Flask, login: Callable[..., FlaskClient]) -> dict[str, Any]:
    return login("stats@example.com").get("/api/stats/dashboard").get_json()


def test_history_is_aggregated_per_day_hour_and_category(
    app: Flask, login: Callable[..., FlaskClient], add_tasks: Callable[..., None]
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    done = now.replace(hour=9, minute=15, second=0)
    for minutes, category in ((60, "work"), (30, "work"), (45, "home")):
        add_tasks(
            title="t",
            category=category,
            is_completed=True,
            completed_at=done,
            start_at=done - timedelta(minutes=minutes),
            end_at=done,
            created_at=done - timedelta(days=2),
        )

    stats = dashboard(app, login)

    today = stats["productivity"][-1]
    assert (today["date"], today["tasks"], today["timeSpent"]) == (
        done.date().isoformat(),
        3,
        135,
    )
    assert len(stats["productivity"]) == 366
    assert stats["timeSpent"] == [
        {"category": "work", "timeSpent": 90},
        {"category": "home", "timeSpent": 45},
    ]
    assert stats["hourlyProductivity"][9]["count"] == 3
    assert stats["turnaround"][2] == {"daysTaken": 2, "count": 3}
    assert stats["distributionTrend"][-1]["work"] == 2
    assert len(stats["estimationAccuracy"]) == 3


def test_backlog_counts_overdue_pending_and_projected_repeats(
    app: Flask, login: Callable[..., FlaskClient], add_tasks: Callable[..., None]
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    add_tasks(
        title="late",
        category="work",
        start_at=now - timedelta(days=6),
        end_at=now - timedelta(days=5),
    )
    add_tasks(
        title="soon",
        category="work",
        start_at=now + timedelta(hours=1),
        end_at=now + timedelta(hours=2),
    )
    add_tasks(
        title="daily",
        category="health",
        is_repeating=True,
        repeat_by="daily",
        start_at=now + timedelta(days=1),
        end_at=now + timedelta(days=1, hours=1),
    )

    stats = dashboard(app, login)

    volume = {v["category"]: v for v in stats["categoryVolume"]}
    assert (volume["work"]["overdue"], volume["work"]["pending"]) == (1, 1)
    assert volume["health"]["pending"] > 2
    assert stats["overdueDistribution"] == [{"daysOverdue": "1 Week", "count": 1}]
    backlog = {b["status"]: b["count"] for b in stats["backlogHealth"]}
    assert (
        backlog["Overdue"] == 1
        and backlog["Pending"]
        == volume["work"]["pending"] + volume["health"]["pending"]
    )
    assert sum(day["count"] for day in stats["weekOverview"]) >= 2


def test_dashboard_aggregates_in_the_database(
    app: Flask, login: Callable[..., FlaskClient], add_tasks: Callable[..., None]
) -> None:
    from sqlalchemy import event

    from app.database import db
    from app.utils.dates import utc_now

    now = utc_now()
    for _ in range(30):
        add_tasks(
            title="t",
            category="work",
            is_completed=True,
            completed_at=now,
            start_at=now - timedelta(hours=1),
            end_at=now,
        )
    session = login("stats@example.com")

    statements = []
    with app.app_context():
        event.listen(
            db.engine, "before_cursor_execute", lambda *a: statements.append(a[2])
        )
        session.get("/api/stats/dashboard")

    assert len(statements) <= 20
