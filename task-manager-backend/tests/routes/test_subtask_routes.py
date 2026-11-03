from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def add_task(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]], **extra: Any
) -> dict[str, Any]:
    response = session.post("/api/tasks", json=task_payload(**extra))
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def add_subtasks(
    session: FlaskClient, parent_id: int, *titles: str
) -> list[dict[str, Any]]:
    response = session.post(
        f"/api/tasks/{parent_id}/subtasks",
        json={"subtasks": [{"title": title} for title in titles]},
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["subtasks"]


def get_task(session: FlaskClient, task_id: int) -> dict[str, Any]:
    return session.get(f"/api/tasks/{task_id}").get_json()


def listed_titles(session: FlaskClient, query: str = "") -> list[str]:
    response = session.get(f"/api/tasks?is_completed=all&{query}")
    return [t["title"] for t in response.get_json()["tasks"]]


def test_subtasks_are_added_in_order_under_their_parent(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)

    created = add_subtasks(session, parent["id"], "one", "two")
    add_subtasks(session, parent["id"], "three")

    assert [s["position"] for s in created] == [0, 1]
    detail = get_task(session, parent["id"])
    assert [s["title"] for s in detail["subtasks"]] == ["one", "two", "three"]
    assert all(s["parentId"] == parent["id"] for s in detail["subtasks"])


def test_subtasks_inherit_the_project_and_never_appear_in_lists(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    project = session.post("/api/projects", json={"name": "Work"}).get_json()
    parent = add_task(session, task_payload, title="parent", projectId=project["id"])

    subtasks = add_subtasks(session, parent["id"], "child needle")

    assert get_task(session, subtasks[0]["id"])["projectId"] == project["id"]
    assert listed_titles(session) == ["parent"]
    assert listed_titles(session, "q=needle") == []
    assert listed_titles(session, f"project={project['id']}") == ["parent"]


def test_list_rows_carry_the_subtask_counts(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    other = add_task(session, task_payload, title="other")
    first, _second = add_subtasks(session, parent["id"], "a", "b")
    session.patch(f"/api/tasks/{first['id']}", json={"isCompleted": True})

    rows = {t["id"]: t for t in session.get("/api/tasks").get_json()["tasks"]}

    assert rows[parent["id"]]["subtaskCount"] == 2
    assert rows[parent["id"]]["subtaskCompletedCount"] == 1
    assert rows[other["id"]]["subtaskCount"] == 0
    assert "subtasks" not in rows[parent["id"]]


def test_a_subtask_cannot_have_subtasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    child = add_subtasks(session, parent["id"], "child")[0]

    response = session.post(
        f"/api/tasks/{child['id']}/subtasks", json={"subtasks": [{"title": "x"}]}
    )

    assert response.status_code == 400
    assert "parentId" in response.get_json()["errors"]


def test_a_subtask_cannot_repeat(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    child = add_subtasks(session, parent["id"], "child")[0]

    response = session.patch(f"/api/tasks/{child['id']}", json={"repeatBy": "daily"})

    assert response.status_code == 400


def test_a_blank_title_or_empty_list_is_rejected(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    url = f"/api/tasks/{parent['id']}/subtasks"

    assert session.post(url, json={"subtasks": []}).status_code == 400
    assert session.post(url, json={"subtasks": [{"title": " "}]}).status_code == 400
    assert session.post(url, json={}).status_code == 400


def test_completing_a_parent_completes_its_open_subtasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    add_subtasks(session, parent["id"], "a", "b")

    session.patch(f"/api/tasks/{parent['id']}", json={"isCompleted": True})

    subtasks = get_task(session, parent["id"])["subtasks"]
    assert all(s["isCompleted"] for s in subtasks)
    assert all(s["completedAt"] for s in subtasks)


def test_rolling_a_repeating_parent_resets_its_subtasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload, repeatBy="daily")
    first = add_subtasks(session, parent["id"], "a", "b")[0]
    session.patch(f"/api/tasks/{first['id']}", json={"isCompleted": True})

    done = session.patch(
        f"/api/tasks/{parent['id']}",
        json={"isCompleted": True, "completedAt": "2026-03-02 10:30:00"},
    )

    assert done.status_code == 200
    detail = get_task(session, parent["id"])
    assert detail["isCompleted"] is False
    assert [s["isCompleted"] for s in detail["subtasks"]] == [False, False]


def test_moving_the_parent_moves_its_subtasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    project = session.post("/api/projects", json={"name": "Home"}).get_json()
    parent = add_task(session, task_payload)
    child = add_subtasks(session, parent["id"], "child")[0]

    session.patch(f"/api/tasks/{parent['id']}", json={"projectId": project["id"]})

    assert get_task(session, child["id"])["projectId"] == project["id"]


def test_trashing_and_restoring_the_parent_carries_the_subtasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    child = add_subtasks(session, parent["id"], "child")[0]

    session.delete(f"/api/tasks/{parent['id']}")

    trash = session.get("/api/tasks/trash").get_json()
    assert [t["id"] for t in trash["tasks"]] == [parent["id"]]
    assert session.get(f"/api/tasks/{child['id']}").status_code == 404

    session.post(f"/api/tasks/{parent['id']}/restore")

    assert get_task(session, child["id"])["title"] == "child"
    assert len(get_task(session, parent["id"])["subtasks"]) == 1


def test_deleting_a_subtask_removes_it_without_a_trash_entry(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    child = add_subtasks(session, parent["id"], "child")[0]

    assert session.delete(f"/api/tasks/{child['id']}").status_code == 200

    assert get_task(session, parent["id"])["subtasks"] == []
    assert session.get("/api/tasks/trash").get_json()["tasks"] == []


def test_subtasks_do_not_count_in_the_stats_or_get_reminders(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    parent = add_task(session, task_payload)
    add_subtasks(session, parent["id"], "a")

    stats = session.get("/api/stats/dashboard")

    assert stats.status_code == 200
