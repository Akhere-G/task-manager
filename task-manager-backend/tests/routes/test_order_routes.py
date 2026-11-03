from typing import Any

import pytest
from flask.testing import FlaskClient

from app.database import db
from app.models import Task

pytestmark = pytest.mark.integration


def add(session: FlaskClient, title: str) -> int:
    response = session.post("/api/tasks", json={"title": title})
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def manual(session: FlaskClient) -> list[str]:
    response = session.get("/api/tasks?sort_by=manual&is_completed=all")
    return [task["title"] for task in response.get_json()["tasks"]]


def move(session: FlaskClient, task_id: int, **body: Any) -> Any:
    return session.post(f"/api/tasks/{task_id}/move", json=body)


def test_new_tasks_start_at_the_top(session: FlaskClient) -> None:
    add(session, "first")
    add(session, "second")

    assert manual(session) == ["second", "first"]


def test_a_batch_keeps_its_own_order_above_older_tasks(session: FlaskClient) -> None:
    add(session, "old")
    session.post(
        "/api/tasks/bulk", json=[{"title": "one"}, {"title": "two"}, {"title": "three"}]
    )

    assert manual(session) == ["one", "two", "three", "old"]


def test_a_task_moves_to_the_top_the_bottom_and_the_middle(
    session: FlaskClient,
) -> None:
    c, b, a = (add(session, name) for name in "cba")  # list: a b c
    assert manual(session) == ["a", "b", "c"]

    assert move(session, c, beforeId=a).status_code == 200
    assert manual(session) == ["c", "a", "b"]

    move(session, c, afterId=b)
    assert manual(session) == ["a", "b", "c"]

    move(session, a, afterId=b, beforeId=c)
    assert manual(session) == ["b", "a", "c"]


def test_moving_between_neighbours_with_no_room_renumbers(
    session: FlaskClient, app: Any
) -> None:
    c, b, a = (add(session, name) for name in "cba")
    with app.app_context():
        for task_id, position in ((a, 10), (b, 11), (c, 50)):
            db.session.get(Task, task_id).sort_order = position
        db.session.commit()

    assert move(session, c, afterId=a, beforeId=b).status_code == 200

    assert manual(session) == ["a", "c", "b"]


def test_a_move_needs_a_neighbour(session: FlaskClient) -> None:
    task = add(session, "alone")

    assert move(session, task).status_code == 400


def test_a_move_beside_a_missing_task_is_refused(session: FlaskClient) -> None:
    task = add(session, "alone")

    assert move(session, task, afterId=999999).status_code == 404
