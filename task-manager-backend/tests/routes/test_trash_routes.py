from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient

from tests.builders import MONDAY, TUESDAY, reschedule_body


def add(session: FlaskClient, payload: dict[str, Any]) -> int:
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201
    return response.get_json()["id"]


def trash(session: FlaskClient, query: str = "") -> dict[str, Any]:
    return session.get(f"/api/tasks/trash{query}").get_json()


def live_titles(session: FlaskClient) -> list[str]:
    tasks = session.get("/api/tasks?is_completed=all").get_json()["tasks"]
    return [task["title"] for task in tasks]


def test_a_deleted_task_leaves_every_view_but_the_trash(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(session, task_payload(title="Gone"))
    add(session, task_payload(title="Kept"))

    assert session.delete(f"/api/tasks/{task_id}").status_code == 200

    assert live_titles(session) == ["Kept"]
    assert session.get(f"/api/tasks/{task_id}").status_code == 404
    assert (
        session.patch(f"/api/tasks/{task_id}", json={"title": "x"}).status_code == 404
    )
    moved = session.post(
        f"/api/tasks/{task_id}/reschedule", json=reschedule_body(MONDAY, TUESDAY)
    )
    assert moved.status_code == 404
    assert session.delete(f"/api/tasks/{task_id}").status_code == 404
    assert [t["title"] for t in trash(session)["tasks"]] == ["Gone"]


def test_a_trashed_task_says_when_it_will_be_purged(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(session, task_payload())
    session.delete(f"/api/tasks/{task_id}")

    (task,) = trash(session)["tasks"]

    assert task["id"] == task_id
    assert task["deletedAt"].endswith("Z")
    assert task["purgeAt"] > task["deletedAt"]
    assert task["purgeAt"][:10] != task["deletedAt"][:10]


def test_the_trash_is_newest_first_and_paged(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    for n in range(3):
        session.delete(f"/api/tasks/{add(session, task_payload(title=f'Task {n}'))}")

    page = trash(session, "?limit=2&page=1")

    assert [t["title"] for t in page["tasks"]] == ["Task 2", "Task 1"]
    assert (page["totalTasks"], page["totalPages"]) == (3, 2)
    assert [t["title"] for t in trash(session, "?limit=2&page=2")["tasks"]] == [
        "Task 0"
    ]


def test_restoring_brings_the_task_back_unchanged(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(session, task_payload(title="Back", priority=1))
    session.delete(f"/api/tasks/{task_id}")

    restored = session.post(f"/api/tasks/{task_id}/restore")

    assert restored.status_code == 200
    assert restored.get_json()["deletedAt"] is None
    assert live_titles(session) == ["Back"]
    assert session.get(f"/api/tasks/{task_id}").get_json()["priority"] == 1
    assert trash(session)["tasks"] == []


def test_only_a_trashed_task_can_be_restored(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(session, task_payload())

    assert session.post(f"/api/tasks/{task_id}/restore").status_code == 404
    assert session.post("/api/tasks/999/restore").status_code == 404


def test_the_deleted_flags_cannot_be_written_through_an_edit(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(session, task_payload())

    session.patch(f"/api/tasks/{task_id}", json={"isDeleted": True})

    assert live_titles(session) == ["Write report"]


def test_a_deleted_repeating_task_stops_producing_ghosts(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = add(
        session,
        task_payload(startAt=MONDAY[0], endAt=MONDAY[1], repeatBy="daily"),
    )
    ghosts = "/api/tasks?start_date=2026-03-03&end_date=2026-03-05T23:59:59&project_repeating=true"
    assert len(session.get(ghosts).get_json()["tasks"]) == 3

    session.delete(f"/api/tasks/{task_id}")

    assert session.get(ghosts).get_json()["tasks"] == []
