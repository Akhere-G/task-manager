from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from tests.builders import MONDAY, TUESDAY, Slot, reschedule_body


def create_daily_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> int:
    response = session.post(
        "/api/tasks",
        json=task_payload(
            startAt="2026-03-02 09:00:00", endAt="2026-03-02 10:00:00", repeatBy="daily"
        ),
    )
    assert response.status_code == 201
    return response.get_json()["id"]


def complete(session: FlaskClient, task_id: int, **extra: Any) -> TestResponse:
    return session.patch(
        f"/api/tasks/{task_id}",
        json={"isCompleted": True, "completedAt": "2026-03-02 10:30:00", **extra},
    )


def all_tasks(session: FlaskClient) -> list[dict[str, Any]]:
    return session.get("/api/tasks?is_completed=all").get_json()["tasks"]


def test_completing_a_repeating_task_records_it_and_moves_to_the_next_day(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)

    assert complete(session, task_id).status_code == 200

    tasks = {t["id"]: t for t in all_tasks(session)}
    assert len(tasks) == 2
    assert tasks[task_id]["isCompleted"] is False
    assert tasks[task_id]["startAt"].startswith("2026-03-03T09:00")
    history = [t for t in tasks.values() if t["id"] != task_id][0]
    assert history["isCompleted"] is True
    assert history["startAt"].startswith("2026-03-02T09:00")


def test_completing_the_same_occurrence_twice_only_counts_once(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)
    occurrence = "2026-03-02 09:00:00"

    assert complete(session, task_id, expectedStartAt=occurrence).status_code == 200
    again = complete(session, task_id, expectedStartAt=occurrence)

    assert again.status_code == 409
    assert len(all_tasks(session)) == 2


def test_end_time_is_checked_against_the_stored_start_time(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = session.post("/api/tasks", json=task_payload()).get_json()["id"]

    response = session.patch(
        f"/api/tasks/{task_id}", json={"endAt": "2026-03-02 09:00:00"}
    )

    assert response.status_code == 400
    assert "endAt" in response.get_json()["errors"]


def test_completing_without_a_timestamp_still_records_when(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = session.post("/api/tasks", json=task_payload()).get_json()["id"]

    done = session.patch(f"/api/tasks/{task_id}", json={"isCompleted": True}).get_json()
    assert done["isCompleted"] is True and done["completedAt"].endswith("Z")

    undone = session.patch(
        f"/api/tasks/{task_id}", json={"isCompleted": False}
    ).get_json()
    assert undone["completedAt"] is None


def test_bulk_import_fixes_completion_and_repeat_flags(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    response = session.post(
        "/api/tasks/bulk",
        json=[
            task_payload(isCompleted=True),
            task_payload(completedAt="2026-03-02 10:30:00"),
            task_payload(repeatBy="weekly"),
        ],
    )
    assert response.status_code == 201

    by_completion = {t["isCompleted"]: t for t in all_tasks(session)}
    assert by_completion[True]["completedAt"] is not None
    assert by_completion[False]["completedAt"] is None
    assert any(t["isRepeating"] for t in all_tasks(session))


def test_bulk_validation_errors_are_listed_per_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    response = session.post(
        "/api/tasks/bulk",
        json=[task_payload(), task_payload(category="nope", title="")],
    )

    assert response.status_code == 400
    errors = response.get_json()["errors"]
    assert errors[0] == {} and set(errors[1]) == {"title", "category"}


def test_a_task_can_be_created_read_edited_and_deleted(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    created = session.post("/api/tasks", json=task_payload(title="  Trim me  "))
    assert created.status_code == 201
    task = created.get_json()
    assert (task["title"], task["startAt"]) == ("Trim me", "2026-03-02T10:00:00Z")
    assert task["seriesId"] == task["id"]

    assert session.get(f"/api/tasks/{task['id']}").get_json() == task

    edited = session.patch(f"/api/tasks/{task['id']}", json={"category": "home"})
    assert edited.get_json()["category"] == "home"

    assert session.delete(f"/api/tasks/{task['id']}").status_code == 200
    assert session.get(f"/api/tasks/{task['id']}").status_code == 404


def test_the_list_is_paged(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    for n in range(5):
        session.post("/api/tasks", json=task_payload(title=f"Task {n}"))

    page = session.get("/api/tasks?limit=2&page=3&sort_by=title&order=asc").get_json()

    assert [task["title"] for task in page["tasks"]] == ["Task 4"]
    assert (page["totalTasks"], page["totalPages"], page["currentPage"]) == (5, 3, 3)


def test_bad_list_filters_are_a_400(session: FlaskClient) -> None:
    assert session.get("/api/tasks?start_date=2026-03-01").status_code == 400


def test_missing_task_is_a_404(session: FlaskClient) -> None:
    assert session.get("/api/tasks/999").status_code == 404
    assert session.patch("/api/tasks/999", json={"title": "x"}).status_code == 404
    assert session.delete("/api/tasks/999").status_code == 404


def test_projecting_a_repeating_task_adds_ghost_occurrences(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)

    response = session.get(
        "/api/tasks?start_date=2026-03-03&end_date=2026-03-05T23:59:59&project_repeating=true"
    )

    tasks = response.get_json()["tasks"]
    ghosts = [t for t in tasks if t.get("isGhost")]
    assert [g["startAt"][:10] for g in ghosts] == [
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
    ]
    assert {g["seriesId"] for g in ghosts} == {task_id}
    assert all(g["id"].startswith(f"ghost_{task_id}_") for g in ghosts)


def reschedule(
    session: FlaskClient, task_id: int, previous: Slot, new: Slot
) -> TestResponse:
    return session.post(
        f"/api/tasks/{task_id}/reschedule", json=reschedule_body(previous, new)
    )


def test_reschedule_returns_the_moved_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)

    response = reschedule(session, task_id, MONDAY, TUESDAY)

    assert response.status_code == 200
    moved = response.get_json()
    assert (moved["id"], moved["startAt"]) == (task_id, "2026-03-03T09:00:00Z")


def test_reschedule_of_a_stale_occurrence_is_a_409_with_the_current_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)

    response = reschedule(session, task_id, TUESDAY, TUESDAY)

    assert response.status_code == 409
    assert response.get_json()["task"]["startAt"] == "2026-03-02T09:00:00Z"


def test_reschedule_rejects_a_bad_payload_and_a_missing_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task_id = create_daily_task(session, task_payload)

    backwards = reschedule(session, task_id, MONDAY, (MONDAY[1], MONDAY[0]))

    assert backwards.status_code == 400
    assert "endAt" in backwards.get_json()["errors"]
    assert reschedule(session, 999, MONDAY, TUESDAY).status_code == 404
