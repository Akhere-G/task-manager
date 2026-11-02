from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def add(session: FlaskClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201
    return response.get_json()


def at_hour(hour: int) -> dict[str, str]:
    return {"startAt": f"2026-03-02 {hour:02}:00", "endAt": f"2026-03-02 {hour:02}:30"}


def titles(session: FlaskClient, query: str) -> list[str]:
    tasks = session.get(f"/api/tasks?{query}").get_json()["tasks"]
    return [task["title"] for task in tasks]


def test_a_task_without_a_priority_is_p4_and_can_be_raised(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    task = add(session, task_payload())
    assert task["priority"] == 4

    edited = session.patch(f"/api/tasks/{task['id']}", json={"priority": 1})

    assert edited.get_json()["priority"] == 1


def test_an_out_of_range_priority_is_a_400(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    assert session.post("/api/tasks", json=task_payload(priority=5)).status_code == 400
    assert session.get("/api/tasks?priority=9").status_code == 400


def test_sorting_by_priority_breaks_ties_by_start(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    add(session, task_payload(title="Late P2", priority=2, **at_hour(15)))
    add(session, task_payload(title="P4", **at_hour(8)))
    add(session, task_payload(title="Early P2", priority=2, **at_hour(9)))
    add(session, task_payload(title="P1", priority=1, **at_hour(16)))

    assert titles(session, "sort_by=priority") == ["P1", "Early P2", "Late P2", "P4"]
    assert titles(session, "sort_by=priority&order=desc")[0] == "P4"


def test_filtering_by_priority_keeps_only_those_levels(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    for priority in (1, 2, 3, 4):
        add(session, task_payload(title=f"P{priority}", priority=priority))

    assert titles(session, "priority=1,3&sort_by=priority") == ["P1", "P3"]
