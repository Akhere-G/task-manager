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
def stats_user_id(make_user: Callable[..., int]) -> int:
    return make_user("stats@example.com")


@pytest.fixture
def add_project(app: Flask, stats_user_id: int) -> Callable[..., int]:
    def add(name: str, parent_id: int | None = None) -> int:
        with app.app_context():
            from app.database import db
            from app.models import Project

            project = Project(user_id=stats_user_id, name=name, parent_id=parent_id)
            db.session.add(project)
            db.session.commit()
            return project.id

    return add


@pytest.fixture
def add_tasks(app: Flask, stats_user_id: int) -> Callable[..., None]:
    user_id = stats_user_id

    def add(**fields: Any) -> None:
        with app.app_context():
            from app.database import db
            from app.models import Task

            db.session.add(Task(user_id=user_id, **fields))
            db.session.commit()

    return add


def dashboard(app: Flask, login: Callable[..., FlaskClient]) -> dict[str, Any]:
    return login("stats@example.com").get("/api/stats/dashboard").get_json()


def test_history_is_aggregated_per_day_hour_and_project(
    app: Flask,
    login: Callable[..., FlaskClient],
    add_tasks: Callable[..., None],
    add_project: Callable[..., int],
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    done = now.replace(hour=9, minute=15, second=0)
    projects = {"Work": add_project("Work"), "Home": add_project("Home")}
    for minutes, project in ((60, "Work"), (30, "Work"), (45, "Home")):
        add_tasks(
            title="t",
            project_id=projects[project],
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
        {"project": "Work", "timeSpent": 90},
        {"project": "Home", "timeSpent": 45},
    ]
    assert stats["hourlyProductivity"][9]["count"] == 3
    assert stats["turnaround"][2] == {"daysTaken": 2, "count": 3}
    today_counts = {
        entry["project"]: entry["count"]
        for entry in stats["distributionTrend"][-1]["counts"]
    }
    assert today_counts == {"Work": 2, "Home": 1}
    assert len(stats["estimationAccuracy"]) == 3


def test_backlog_counts_overdue_pending_and_projected_repeats(
    app: Flask,
    login: Callable[..., FlaskClient],
    add_tasks: Callable[..., None],
    add_project: Callable[..., int],
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    work, health = add_project("Work"), add_project("Health")
    add_tasks(
        title="late",
        project_id=work,
        start_at=now - timedelta(days=6),
        end_at=now - timedelta(days=5),
    )
    add_tasks(
        title="soon",
        project_id=work,
        start_at=now + timedelta(hours=1),
        end_at=now + timedelta(hours=2),
    )
    add_tasks(
        title="daily",
        project_id=health,
        is_repeating=True,
        repeat_by="daily",
        start_at=now + timedelta(days=1),
        end_at=now + timedelta(days=1, hours=1),
    )

    stats = dashboard(app, login)

    volume = {v["project"]: v for v in stats["projectVolume"]}
    assert (volume["Work"]["overdue"], volume["Work"]["pending"]) == (1, 1)
    assert volume["Health"]["pending"] > 2
    assert stats["overdueDistribution"] == [{"daysOverdue": "1 Week", "count": 1}]
    backlog = {b["status"]: b["count"] for b in stats["backlogHealth"]}
    assert (
        backlog["Overdue"] == 1
        and backlog["Pending"]
        == volume["Work"]["pending"] + volume["Health"]["pending"]
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


def test_deleted_tasks_do_not_count_in_the_stats(
    app: Flask, login: Callable[..., FlaskClient], add_tasks: Callable[..., None]
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    add_tasks(
        title="late",
        start_at=now - timedelta(days=6),
        end_at=now - timedelta(days=5),
        is_deleted=True,
        deleted_at=now,
    )

    stats = dashboard(app, login)

    assert stats["overdueDistribution"] == []
    assert not any(v["overdue"] for v in stats["projectVolume"])


def test_a_child_projects_tasks_count_towards_its_top_level_project(
    app: Flask,
    login: Callable[..., FlaskClient],
    add_tasks: Callable[..., None],
    add_project: Callable[..., int],
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    work = add_project("Work")
    reports = add_project("Reports", work)
    for project_id in (work, reports, reports):
        add_tasks(
            title="done",
            project_id=project_id,
            is_completed=True,
            completed_at=now,
            start_at=now - timedelta(minutes=30),
            end_at=now,
        )

    stats = dashboard(app, login)

    assert stats["timeSpent"] == [{"project": "Work", "timeSpent": 90}]
    volume = {v["project"]: v for v in stats["projectVolume"]}
    assert volume["Work"]["completed"] == 3 and "Reports" not in volume


def test_tasks_without_a_project_are_counted_as_inbox(
    app: Flask, login: Callable[..., FlaskClient], add_tasks: Callable[..., None]
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    add_tasks(
        title="loose",
        is_completed=True,
        completed_at=now,
        start_at=now - timedelta(minutes=30),
        end_at=now,
    )

    stats = dashboard(app, login)

    assert stats["timeSpent"] == [{"project": "Inbox", "timeSpent": 30}]


def test_the_week_trend_shows_the_top_eight_projects_and_groups_the_rest(
    app: Flask,
    login: Callable[..., FlaskClient],
    add_tasks: Callable[..., None],
    add_project: Callable[..., int],
) -> None:
    from app.utils.dates import utc_now

    now = utc_now().replace(microsecond=0)
    for number in range(10):
        project_id = add_project(f"P{number}")
        for _ in range(10 - number):
            add_tasks(
                title="done",
                project_id=project_id,
                is_completed=True,
                completed_at=now,
                start_at=now - timedelta(minutes=30),
                end_at=now,
            )

    stats = dashboard(app, login)

    counts = {
        entry["project"]: entry["count"]
        for entry in stats["distributionTrend"][-1]["counts"]
    }
    assert list(counts) == [f"P{n}" for n in range(8)] + ["Other"]
    assert counts["P0"] == 10 and counts["Other"] == 3
