from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from flask.testing import FlaskClient

from tests.routes.test_column_routes import add_project, add_task, column_named

pytestmark = pytest.mark.integration

HOUR = timedelta(hours=1)


def _iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def add_overdue(session: FlaskClient, title: str, **extra: Any) -> int:
    end = datetime.now(UTC) - HOUR
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


def task_state(session: FlaskClient, task_id: int) -> Any:
    return session.get(f"/api/tasks/{task_id}").get_json()


def test_a_group_filter_completes_every_task_in_the_group(
    session: FlaskClient,
) -> None:
    overdue = [add_overdue(session, f"Late {number}") for number in range(12)]
    untouched = session.post("/api/tasks", json={"title": "Someday"}).get_json()

    response = session.post(
        "/api/tasks/bulk-complete",
        json={"filter": {"group": "overdue", "zone": "UTC"}},
    )

    assert response.get_json() == {"updated": 12, "matched": 12}
    assert all(task_state(session, task_id)["isCompleted"] for task_id in overdue)
    assert task_state(session, untouched["id"])["isCompleted"] is False


def test_a_group_filter_deletes_to_the_trash(session: FlaskClient) -> None:
    add_overdue(session, "Late")

    session.post("/api/tasks/bulk-delete", json={"filter": {"group": "overdue"}})

    assert session.get("/api/tasks/trash").get_json()["totalTasks"] == 1


def test_a_group_filter_reschedules_to_a_day(session: FlaskClient) -> None:
    late = add_overdue(session, "Late")

    response = session.post(
        "/api/tasks/bulk-snooze",
        json={
            "filter": {"group": "overdue"},
            "preset": "date",
            "day": "2031-05-06",
            "zoneName": "UTC",
        },
    )

    assert response.get_json() == {"updated": 1, "matched": 1}
    assert task_state(session, late)["startAt"].startswith("2031-05-06")


def test_the_priority_of_a_whole_category_changes(session: FlaskClient) -> None:
    urgent = [
        session.post("/api/tasks", json={"title": f"Urgent {n}", "priority": 1})
        for n in range(3)
    ]
    calm = session.post("/api/tasks", json={"title": "Calm", "priority": 4})

    response = session.post(
        "/api/tasks/bulk-priority",
        json={"filter": {"priority": "1"}, "priority": 2},
    )

    assert response.get_json() == {"updated": 3, "matched": 3}
    changed = [task_state(session, r.get_json()["id"])["priority"] for r in urgent]
    assert changed == [2, 2, 2]
    assert task_state(session, calm.get_json()["id"])["priority"] == 4


def test_a_column_is_emptied_into_another_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    todo = column_named(session, project_id, "To Do")
    doing = column_named(session, project_id, "In Progress")
    first = add_task(session, project_id, "First")
    second = add_task(session, project_id, "Second")
    ids = [first["id"], second["id"]]
    session.post("/api/tasks/bulk-move", json={"ids": ids, "columnId": todo["id"]})

    response = session.post(
        "/api/tasks/bulk-move",
        json={
            "filter": {"project": project_id, "column": todo["id"]},
            "columnId": doing["id"],
        },
    )

    assert response.get_json() == {"updated": 2, "matched": 2}
    assert {task_state(session, task_id)["columnId"] for task_id in ids} == {
        doing["id"]
    }


def test_tasks_move_to_unassigned(session: FlaskClient) -> None:
    project_id = add_project(session)
    todo = column_named(session, project_id, "To Do")
    task = add_task(session, project_id, "First")
    session.post(
        "/api/tasks/bulk-move", json={"ids": [task["id"]], "columnId": todo["id"]}
    )

    session.post(
        "/api/tasks/bulk-move",
        json={"ids": [task["id"]], "columnId": None},
    )

    assert task_state(session, task["id"])["columnId"] is None


def test_a_task_from_another_project_is_skipped_by_a_move(
    session: FlaskClient,
) -> None:
    board = add_project(session)
    other = add_project(session, "Other")
    todo = column_named(session, board, "To Do")
    stranger = add_task(session, other, "Stranger")

    response = session.post(
        "/api/tasks/bulk-move", json={"ids": [stranger["id"]], "columnId": todo["id"]}
    )

    assert response.get_json() == {"updated": 0, "matched": 1}


def test_a_filter_is_capped_and_reports_what_it_matched(
    session: FlaskClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.bulk_target.MAX_BULK_FILTER_TASKS", 2)
    for number in range(3):
        add_overdue(session, f"Late {number}")

    response = session.post(
        "/api/tasks/bulk-complete", json={"filter": {"group": "overdue"}}
    )

    assert response.get_json() == {"updated": 2, "matched": 2}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"ids": [1], "filter": {"group": "overdue"}},
        {"filter": {}},
        {"filter": {"project": 1}},
        {"filter": {"unassigned": False}},
        {"filter": {"group": "nonsense"}},
        {"filter": {"group": "overdue", "view": "inbox"}},
    ],
)
def test_a_target_needs_ids_or_a_category_filter(
    session: FlaskClient, body: dict[str, Any]
) -> None:
    assert session.post("/api/tasks/bulk-complete", json=body).status_code == 400


@pytest.mark.parametrize("priority", [0, 5, "1", None])
def test_a_bulk_priority_must_be_one_to_four(
    session: FlaskClient, priority: Any
) -> None:
    response = session.post(
        "/api/tasks/bulk-priority", json={"ids": [1], "priority": priority}
    )

    assert response.status_code == 400


def test_a_filter_never_reaches_another_users_tasks(make_user: Any, login: Any) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    owner, other = login("a@example.com"), login("b@example.com")
    task_id = add_overdue(owner, "Mine")

    response = other.post(
        "/api/tasks/bulk-delete", json={"filter": {"group": "overdue"}}
    )

    assert response.get_json() == {"updated": 0, "matched": 0}
    assert task_state(owner, task_id)["title"] == "Mine"
