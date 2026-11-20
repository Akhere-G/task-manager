from collections.abc import Callable
from typing import Any

import pytest
from flask.testing import FlaskClient

from app.services import bulk_task_service

pytestmark = pytest.mark.integration

TaskPayload = Callable[..., dict[str, Any]]


def add_tasks(
    session: FlaskClient, task_payload: TaskPayload, count: int = 3
) -> list[int]:
    ids = []
    for number in range(count):
        response = session.post("/api/tasks", json=task_payload(title=f"Task {number}"))
        ids.append(response.get_json()["id"])
    return ids


def test_tasks_are_completed_in_bulk(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    ids = add_tasks(session, task_payload)

    response = session.post("/api/tasks/bulk-complete", json={"ids": ids[:2]})

    assert response.get_json() == {"updated": 2, "matched": 2}
    done = [session.get(f"/api/tasks/{task_id}").get_json() for task_id in ids]
    assert [task["isCompleted"] for task in done] == [True, True, False]


def test_a_repeating_task_rolls_when_completed_in_bulk(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    created = session.post(
        "/api/tasks", json=task_payload(repeatBy="daily", repeatInterval=1)
    ).get_json()

    session.post("/api/tasks/bulk-complete", json={"ids": [created["id"]]})

    rolled = session.get(f"/api/tasks/{created['id']}").get_json()
    assert rolled["isCompleted"] is False
    assert rolled["startAt"] > created["startAt"]


def test_tasks_are_snoozed_in_bulk_and_undated_ones_are_skipped(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    ids = add_tasks(session, task_payload, 2)
    undated = session.post("/api/tasks", json={"title": "Undated"}).get_json()["id"]

    response = session.post(
        "/api/tasks/bulk-snooze",
        json={
            "ids": [*ids, undated],
            "preset": "date",
            "day": "2031-05-06",
            "zoneName": "UTC",
        },
    )

    assert response.get_json() == {"updated": 2, "matched": 3}
    moved = session.get(f"/api/tasks/{ids[0]}").get_json()
    assert moved["startAt"].startswith("2031-05-06")


def test_tasks_are_deleted_to_the_trash_in_bulk(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    ids = add_tasks(session, task_payload)

    response = session.post("/api/tasks/bulk-delete", json={"ids": ids[:2]})

    assert response.get_json() == {"updated": 2, "matched": 2}
    assert session.get(f"/api/tasks/{ids[0]}").status_code == 404
    assert session.get("/api/tasks/trash").get_json()["totalTasks"] == 2


@pytest.mark.parametrize("endpoint", ["bulk-complete", "bulk-delete"])
@pytest.mark.parametrize("ids", [[], list(range(1, 102)), ["a"], [0], "1", None])
def test_bad_id_lists_are_rejected(
    session: FlaskClient, endpoint: str, ids: Any
) -> None:
    response = session.post(f"/api/tasks/{endpoint}", json={"ids": ids})

    assert response.status_code == 400


def test_bulk_snooze_rejects_projected_occurrences(session: FlaskClient) -> None:
    response = session.post(
        "/api/tasks/bulk-snooze",
        json={"ids": [1], "preset": "tomorrow", "zoneName": "UTC", "isGhost": True},
    )

    assert response.status_code == 400


def test_other_users_tasks_are_skipped(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: TaskPayload,
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    owner, other = login("a@example.com"), login("b@example.com")
    ids = add_tasks(owner, task_payload, 2)

    for endpoint in ("bulk-complete", "bulk-delete"):
        response = other.post(f"/api/tasks/{endpoint}", json={"ids": ids})
        assert response.get_json() == {"updated": 0, "matched": 2}

    still_open = owner.get(f"/api/tasks/{ids[0]}").get_json()
    assert still_open["isCompleted"] is False


def fail_on_second_call(monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    real = getattr(bulk_task_service, name)
    calls: list[int] = []

    def flaky(*args: Any) -> object:
        calls.append(1)
        if len(calls) == 2:
            raise RuntimeError("database went away")
        return real(*args)

    monkeypatch.setattr(bulk_task_service, name, flaky)


def test_a_failure_part_way_changes_no_task_in_a_bulk_complete(
    session: FlaskClient, task_payload: TaskPayload, monkeypatch: pytest.MonkeyPatch
) -> None:
    ids = add_tasks(session, task_payload)
    fail_on_second_call(monkeypatch, "apply_task_update")

    response = session.post("/api/tasks/bulk-complete", json={"ids": ids})

    assert response.status_code == 500
    done = [session.get(f"/api/tasks/{task_id}").get_json() for task_id in ids]
    assert [task["isCompleted"] for task in done] == [False, False, False]


def test_a_failure_part_way_deletes_no_task_in_a_bulk_delete(
    session: FlaskClient, task_payload: TaskPayload, monkeypatch: pytest.MonkeyPatch
) -> None:
    ids = add_tasks(session, task_payload)
    fail_on_second_call(monkeypatch, "apply_task_trash")

    response = session.post("/api/tasks/bulk-delete", json={"ids": ids})

    assert response.status_code == 500
    statuses = [session.get(f"/api/tasks/{task_id}").status_code for task_id in ids]
    assert statuses == [200, 200, 200]


def test_a_task_that_cannot_be_updated_does_not_stop_the_others(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    ids = add_tasks(session, task_payload, 2)
    missing_id = 999_999

    response = session.post(
        "/api/tasks/bulk-complete", json={"ids": [ids[0], missing_id, ids[1]]}
    )

    assert response.get_json() == {"updated": 2, "matched": 3}
    done = [session.get(f"/api/tasks/{task_id}").get_json() for task_id in ids]
    assert [task["isCompleted"] for task in done] == [True, True]
