from collections.abc import Callable
from typing import Any

from flask import Flask
from flask.testing import FlaskClient
from sqlalchemy import event

from app.constants import MAX_LABELS_PER_TASK
from app.database import db


def add_label(session: FlaskClient, name: str, **extra: Any) -> dict[str, Any]:
    response = session.post("/api/labels", json={"name": name, **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def add_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]], **extra: Any
) -> dict[str, Any]:
    response = session.post("/api/tasks", json=task_payload(**extra))
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def get_task(session: FlaskClient, task_id: int) -> dict[str, Any]:
    return session.get(f"/api/tasks/{task_id}").get_json()


def test_labels_can_be_created_listed_renamed_and_deleted(
    session: FlaskClient,
) -> None:
    label = add_label(session, "urgent", colour="#ff0000")
    assert label["colour"] == "#ff0000"

    edited = session.patch(f"/api/labels/{label['id']}", json={"name": "asap"})
    assert edited.get_json()["name"] == "asap"
    assert [x["name"] for x in session.get("/api/labels").get_json()["labels"]] == [
        "asap"
    ]

    assert session.delete(f"/api/labels/{label['id']}").status_code == 200
    assert session.get("/api/labels").get_json()["labels"] == []


def test_a_bad_colour_or_blank_name_is_rejected(session: FlaskClient) -> None:
    assert (
        session.post("/api/labels", json={"name": "a", "colour": "red"}).status_code
        == 400
    )
    assert session.post("/api/labels", json={"name": "  "}).status_code == 400


def test_label_names_are_unique_ignoring_case(session: FlaskClient) -> None:
    label = add_label(session, "Home")
    other = add_label(session, "Work")

    assert session.post("/api/labels", json={"name": "home"}).status_code == 409
    clash = session.patch(f"/api/labels/{other['id']}", json={"name": "HOME"})
    assert clash.status_code == 409
    same = session.patch(f"/api/labels/{label['id']}", json={"name": "Home"})
    assert same.status_code == 200


def test_a_task_is_created_with_labels(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    first = add_label(session, "one")
    second = add_label(session, "two")

    task = add_task(session, task_payload, labelIds=[second["id"], first["id"]])

    assert sorted(task["labelIds"]) == sorted([first["id"], second["id"]])
    assert sorted(get_task(session, task["id"])["labelIds"]) == sorted(
        [first["id"], second["id"]]
    )


def test_a_task_without_labels_has_an_empty_list(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    assert add_task(session, task_payload)["labelIds"] == []


def test_patching_label_ids_replaces_the_set(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    first = add_label(session, "one")
    second = add_label(session, "two")
    task = add_task(session, task_payload, labelIds=[first["id"]])

    session.patch(f"/api/tasks/{task['id']}", json={"labelIds": [second["id"]]})
    assert get_task(session, task["id"])["labelIds"] == [second["id"]]

    session.patch(f"/api/tasks/{task['id']}", json={"title": "Renamed"})
    assert get_task(session, task["id"])["labelIds"] == [second["id"]]

    session.patch(f"/api/tasks/{task['id']}", json={"labelIds": []})
    assert get_task(session, task["id"])["labelIds"] == []


def test_too_many_labels_are_rejected(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    ids = [add_label(session, f"l{i}")["id"] for i in range(MAX_LABELS_PER_TASK + 1)]

    response = session.post("/api/tasks", json=task_payload(labelIds=ids))

    assert response.status_code == 400
    assert "labelIds" in response.get_json()["errors"]


def test_the_label_filter_matches_any_of_the_labels(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    first = add_label(session, "one")
    second = add_label(session, "two")
    add_task(session, task_payload, title="a", labelIds=[first["id"]])
    add_task(session, task_payload, title="b", labelIds=[second["id"]])
    add_task(session, task_payload, title="c")

    def titles(label: str) -> set[str]:
        response = session.get(f"/api/tasks?is_completed=all&label={label}")
        return {t["title"] for t in response.get_json()["tasks"]}

    assert titles(str(first["id"])) == {"a"}
    assert titles(f"{first['id']},{second['id']}") == {"a", "b"}


def test_a_malformed_label_filter_is_rejected(session: FlaskClient) -> None:
    assert session.get("/api/tasks?label=abc").status_code == 400


def test_deleting_a_label_removes_it_from_its_tasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    keep = add_label(session, "keep")
    drop = add_label(session, "drop")
    task = add_task(session, task_payload, labelIds=[keep["id"], drop["id"]])

    session.delete(f"/api/labels/{drop['id']}")

    assert get_task(session, task["id"])["labelIds"] == [keep["id"]]


def test_completing_a_repeating_task_copies_labels_to_the_history(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    label = add_label(session, "habit")
    task = add_task(
        session,
        task_payload,
        startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00",
        repeatBy="daily",
        labelIds=[label["id"]],
    )

    session.patch(
        f"/api/tasks/{task['id']}",
        json={"isCompleted": True, "completedAt": "2026-03-02 10:30:00"},
    )

    tasks = session.get("/api/tasks?is_completed=all").get_json()["tasks"]
    assert len(tasks) == 2
    assert all(t["labelIds"] == [label["id"]] for t in tasks)


def test_projected_occurrences_carry_the_labels(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    label = add_label(session, "habit")
    add_task(
        session,
        task_payload,
        startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00",
        repeatBy="daily",
        labelIds=[label["id"]],
    )

    response = session.get(
        "/api/tasks?start_date=2026-03-03&end_date=2026-03-05T23:59:59"
        "&project_repeating=true"
    )

    ghosts = [t for t in response.get_json()["tasks"] if t.get("isGhost")]
    assert ghosts
    assert all(t["labelIds"] == [label["id"]] for t in ghosts)


def test_a_page_of_tasks_loads_its_labels_in_one_query(
    app: Flask,
    session: FlaskClient,
    task_payload: Callable[..., dict[str, Any]],
) -> None:
    label = add_label(session, "bulk")
    for i in range(50):
        add_task(session, task_payload, title=f"t{i}", labelIds=[label["id"]])

    statements: list[str] = []
    with app.app_context():
        event.listen(
            db.engine, "before_cursor_execute", lambda *a: statements.append(a[2])
        )
        response = session.get("/api/tasks?is_completed=all&limit=50")

    assert len(response.get_json()["tasks"]) == 50
    assert len([s for s in statements if "FROM task_labels" in s]) == 1
