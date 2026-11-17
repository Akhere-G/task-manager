from datetime import UTC, datetime, time, timedelta

import pytest
from flask.testing import FlaskClient

pytestmark = pytest.mark.integration

HOUR = timedelta(hours=1)


def _iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _start_of_tomorrow() -> datetime:
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=UTC)


def add_dated(session: FlaskClient, title: str, end: datetime, **extra: object) -> int:
    response = session.post(
        "/api/tasks",
        json={
            "title": title,
            "startAt": _iso(end - HOUR),
            "endAt": _iso(end),
            **extra,
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def add_undated(session: FlaskClient, title: str) -> int:
    response = session.post("/api/tasks", json={"title": title})
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def titles(session: FlaskClient, group: str, extra: str = "") -> list[str]:
    response = session.get(f"/api/tasks?group={group}&sort_by=title&zone=UTC{extra}")
    assert response.status_code == 200, response.get_json()
    return [task["title"] for task in response.get_json()["tasks"]]


@pytest.fixture
def week_of_tasks(session: FlaskClient) -> FlaskClient:
    now = datetime.now(UTC)
    add_dated(session, "Late", now - 2 * HOUR)
    add_dated(session, "Tonight", _start_of_tomorrow() - timedelta(seconds=1))
    add_dated(session, "Later", _start_of_tomorrow() + HOUR)
    add_dated(session, "Far away", now + timedelta(days=90))
    add_undated(session, "Someday")
    done = add_dated(session, "Finished", now - 5 * HOUR)
    session.patch(f"/api/tasks/{done}", json={"isCompleted": True})
    return session


def test_each_group_lists_its_own_tasks(week_of_tasks: FlaskClient) -> None:
    assert titles(week_of_tasks, "overdue") == ["Late"]
    assert titles(week_of_tasks, "today") == ["Tonight"]
    assert titles(week_of_tasks, "upcoming") == ["Far away", "Later"]
    assert titles(week_of_tasks, "undated") == ["Someday"]
    assert titles(week_of_tasks, "completed") == ["Finished"]


def test_groups_never_share_a_task(week_of_tasks: FlaskClient) -> None:
    groups = ("overdue", "today", "upcoming", "undated", "completed")
    listed = [title for group in groups for title in titles(week_of_tasks, group)]

    assert len(listed) == len(set(listed)) == 6


def test_a_group_pages_ten_at_a_time(session: FlaskClient) -> None:
    for number in range(11):
        add_dated(session, f"Late {number}", datetime.now(UTC) - HOUR)

    page = session.get("/api/tasks?group=overdue&limit=10&page=2").get_json()

    assert len(page["tasks"]) == 1
    assert (page["totalTasks"], page["totalPages"]) == (11, 2)


def test_a_group_reports_its_total_minutes(session: FlaskClient) -> None:
    add_dated(session, "Late", datetime.now(UTC) - HOUR)

    page = session.get("/api/tasks?group=overdue&limit=10").get_json()

    assert page["totalMinutes"] == 60


@pytest.mark.parametrize("conflict", ["view=inbox", "is_completed=true"])
def test_a_group_cannot_be_combined(session: FlaskClient, conflict: str) -> None:
    assert session.get(f"/api/tasks?group=today&{conflict}").status_code == 400


def test_an_unknown_group_is_a_400(session: FlaskClient) -> None:
    assert session.get("/api/tasks?group=someday").status_code == 400


def test_a_group_respects_the_project_filter(session: FlaskClient) -> None:
    project = session.post("/api/projects", json={"name": "Work"}).get_json()
    add_dated(session, "In project", datetime.now(UTC) - HOUR, projectId=project["id"])
    add_dated(session, "Elsewhere", datetime.now(UTC) - HOUR)

    assert titles(session, "overdue", f"&project={project['id']}") == ["In project"]
