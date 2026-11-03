from collections.abc import Callable
from typing import Any

from flask import Flask
from flask.testing import FlaskClient

from tests.builders import reschedule_body


def create_task(session: FlaskClient, payload: dict[str, Any]) -> int:
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def test_user_cannot_touch_another_users_task(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    task_id = create_task(a, task_payload())

    assert b.get(f"/api/tasks/{task_id}").status_code == 404
    assert (
        b.patch(f"/api/tasks/{task_id}", json={"title": "Hijacked"}).status_code == 404
    )
    assert b.delete(f"/api/tasks/{task_id}").status_code == 404
    reschedule = reschedule_body(
        ("2026-03-02 10:00:00", "2026-03-02 11:00:00"),
        ("2026-03-03 10:00:00", "2026-03-03 11:00:00"),
    )
    moved = b.post(f"/api/tasks/{task_id}/reschedule", json=reschedule)
    assert moved.status_code == 404

    own = a.get(f"/api/tasks/{task_id}")
    assert own.status_code == 200
    assert own.get_json()["title"] == "Write report"
    assert own.get_json()["startAt"] == "2026-03-02T10:00:00Z"


def test_task_list_only_returns_own_tasks(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    create_task(a, task_payload(title="Alpha task"))
    create_task(b, task_payload(title="Beta task"))

    titles_a = [t["title"] for t in a.get("/api/tasks").get_json()["tasks"]]
    titles_b = [t["title"] for t in b.get("/api/tasks").get_json()["tasks"]]
    assert titles_a == ["Alpha task"]
    assert titles_b == ["Beta task"]


def test_stats_only_count_own_tasks(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    create_task(a, task_payload())
    create_task(a, task_payload(title="Second"))

    stats = b.get("/api/stats/dashboard").get_json()
    assert sum(item["count"] for item in stats["backlogHealth"]) == 0


def test_cannot_read_another_users_notification(
    app: Flask, make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    from app.database import db
    from app.models import Notification

    a_id = make_user("a@example.com")
    make_user("b@example.com")
    with app.app_context():
        note = Notification(user_id=a_id, title="Private", message="Only for A")
        db.session.add(note)
        db.session.commit()
        note_id = note.id

    b = login("b@example.com")
    assert b.get("/api/notifications").get_json() == []
    assert b.patch(f"/api/notifications/{note_id}/read").status_code == 404


def test_requests_without_login_are_rejected(client: FlaskClient) -> None:
    assert client.get("/api/tasks").status_code == 401
    assert client.post("/api/tasks", json={}).status_code == 401
    assert client.post("/api/tasks/1/reschedule", json={}).status_code == 401
    assert client.get("/api/stats/dashboard").status_code == 401


def test_user_cannot_see_or_restore_another_users_trash(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    task_id = create_task(a, task_payload())
    a.delete(f"/api/tasks/{task_id}")

    assert b.get("/api/tasks/trash").get_json()["tasks"] == []
    assert b.post(f"/api/tasks/{task_id}/restore").status_code == 404
    assert len(a.get("/api/tasks/trash").get_json()["tasks"]) == 1


def test_user_cannot_use_or_change_another_users_project(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    project_id = a.post("/api/projects", json={"name": "Secret"}).get_json()["id"]

    assert b.get("/api/projects").get_json()["projects"] == []
    assert b.patch(f"/api/projects/{project_id}", json={"name": "X"}).status_code == 404
    assert b.delete(f"/api/projects/{project_id}").status_code == 404
    nested = b.post("/api/projects", json={"name": "Mine", "parentId": project_id})
    assert nested.status_code == 400
    assigned = b.post("/api/tasks", json=task_payload(projectId=project_id))
    assert assigned.status_code == 400
    own = create_task(b, task_payload())
    moved = b.patch(f"/api/tasks/{own}", json={"projectId": project_id})
    assert moved.status_code == 400
    assert a.get("/api/projects").get_json()["projects"][0]["name"] == "Secret"


def test_user_cannot_use_or_change_another_users_label(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    label_id = a.post("/api/labels", json={"name": "Secret"}).get_json()["id"]

    assert b.get("/api/labels").get_json()["labels"] == []
    assert b.patch(f"/api/labels/{label_id}", json={"name": "X"}).status_code == 404
    assert b.delete(f"/api/labels/{label_id}").status_code == 404
    assigned = b.post("/api/tasks", json=task_payload(labelIds=[label_id]))
    assert assigned.status_code == 400
    own = create_task(b, task_payload())
    moved = b.patch(f"/api/tasks/{own}", json={"labelIds": [label_id]})
    assert moved.status_code == 400
    assert a.get("/api/labels").get_json()["labels"][0]["name"] == "Secret"


def test_user_cannot_add_subtasks_to_another_users_task(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    task_id = create_task(a, task_payload())

    response = b.post(
        f"/api/tasks/{task_id}/subtasks", json={"subtasks": [{"title": "x"}]}
    )

    assert response.status_code == 404
    assert a.get(f"/api/tasks/{task_id}").get_json()["subtasks"] == []


def test_a_patch_cannot_reparent_a_task(
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    foreign = create_task(a, task_payload())
    own = create_task(b, task_payload())

    b.patch(f"/api/tasks/{own}", json={"parentId": foreign})

    assert a.get(f"/api/tasks/{foreign}").get_json()["subtasks"] == []
    assert b.get(f"/api/tasks/{own}").get_json()["parentId"] is None
