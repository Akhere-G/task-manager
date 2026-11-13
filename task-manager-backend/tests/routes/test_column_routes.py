from typing import Any

import pytest
from flask.testing import FlaskClient

pytestmark = pytest.mark.integration


def add_project(session: FlaskClient, name: str = "Work") -> int:
    response = session.post("/api/projects", json={"name": name})
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def columns_of(session: FlaskClient, project_id: int) -> list[dict[str, Any]]:
    response = session.get(f"/api/projects/{project_id}/columns")
    assert response.status_code == 200, response.get_json()
    return response.get_json()["columns"]


def column_named(session: FlaskClient, project_id: int, name: str) -> dict[str, Any]:
    return next(c for c in columns_of(session, project_id) if c["name"] == name)


def add_task(session: FlaskClient, project_id: int, title: str, **extra: Any) -> Any:
    response = session.post(
        "/api/tasks", json={"title": title, "projectId": project_id, **extra}
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def drop(session: FlaskClient, task_id: int, column_id: int, **body: Any) -> Any:
    return session.post(
        f"/api/tasks/{task_id}/board-move", json={"columnId": column_id, **body}
    )


def test_a_new_project_gets_the_default_columns(session: FlaskClient) -> None:
    columns = columns_of(session, add_project(session))

    assert [(c["name"], c["status"], c["onDrop"]) for c in columns] == [
        ("To Do", "pending", "uncomplete"),
        ("In Progress", "in_progress", "uncomplete"),
        ("Done", "done", "complete"),
    ]


def test_columns_can_be_added_renamed_and_recoloured(session: FlaskClient) -> None:
    project_id = add_project(session)
    created = session.post(
        f"/api/projects/{project_id}/columns", json={"name": "Review"}
    )
    assert created.status_code == 201
    column = created.get_json()
    assert column["status"] == "Review" and column["onDrop"] == "nothing"
    assert column["position"] == 3

    edited = session.patch(
        f"/api/columns/{column['id']}",
        json={"name": "QA", "colour": "#ff0000", "onDrop": "delete"},
    )
    assert edited.get_json()["name"] == "QA"
    assert edited.get_json()["onDrop"] == "delete"


def test_column_names_are_unique_per_project(session: FlaskClient) -> None:
    project_id = add_project(session)
    clash = session.post(f"/api/projects/{project_id}/columns", json={"name": "done"})
    assert clash.status_code == 409


def test_a_bad_on_drop_or_colour_is_rejected(session: FlaskClient) -> None:
    project_id = add_project(session)
    url = f"/api/projects/{project_id}/columns"
    assert session.post(url, json={"name": "A", "onDrop": "explode"}).status_code == 400
    assert session.post(url, json={"name": "A", "colour": "red"}).status_code == 400


def test_columns_are_reordered(session: FlaskClient) -> None:
    project_id = add_project(session)
    ids = [c["id"] for c in columns_of(session, project_id)]

    response = session.put(
        f"/api/projects/{project_id}/columns/order", json={"columnIds": ids[::-1]}
    )

    assert [c["id"] for c in response.get_json()["columns"]] == ids[::-1]
    assert [c["id"] for c in columns_of(session, project_id)] == ids[::-1]
    partial = session.put(
        f"/api/projects/{project_id}/columns/order", json={"columnIds": ids[:2]}
    )
    assert partial.status_code == 400


def test_new_tasks_start_unassigned(session: FlaskClient) -> None:
    task = add_task(session, add_project(session), "one")

    assert task["columnId"] is None
    assert (
        session.post("/api/tasks", json={"title": "inbox"}).get_json()["columnId"]
        is None
    )


def test_a_task_can_be_created_in_a_chosen_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    review = column_named(session, project_id, "In Progress")

    task = add_task(session, project_id, "one", columnId=review["id"])

    assert task["columnId"] == review["id"]


def test_a_column_from_another_project_is_rejected(session: FlaskClient) -> None:
    other = column_named(session, add_project(session, "Other"), "Done")
    response = session.post(
        "/api/tasks",
        json={"title": "x", "projectId": add_project(session), "columnId": other["id"]},
    )
    assert response.status_code == 400


def test_dropping_on_done_completes_and_on_to_do_reopens(session: FlaskClient) -> None:
    project_id = add_project(session)
    task = add_task(session, project_id, "one")
    done = column_named(session, project_id, "Done")
    todo = column_named(session, project_id, "To Do")

    finished = drop(session, task["id"], done["id"]).get_json()
    assert finished["columnId"] == done["id"]
    assert finished["isCompleted"] is True and finished["completedAt"]

    reopened = drop(session, task["id"], todo["id"]).get_json()
    assert reopened["columnId"] == todo["id"]
    assert reopened["isCompleted"] is False and reopened["completedAt"] is None


def test_dropping_on_a_nothing_column_keeps_completion(session: FlaskClient) -> None:
    project_id = add_project(session)
    task = add_task(session, project_id, "one", isCompleted=True)
    review = session.post(
        f"/api/projects/{project_id}/columns", json={"name": "Review"}
    ).get_json()

    moved = drop(session, task["id"], review["id"]).get_json()

    assert moved["columnId"] == review["id"] and moved["isCompleted"] is True


def test_dropping_on_a_delete_column_moves_the_task_to_trash(
    session: FlaskClient,
) -> None:
    project_id = add_project(session)
    task = add_task(session, project_id, "one")
    bin_column = session.post(
        f"/api/projects/{project_id}/columns", json={"name": "Bin", "onDrop": "delete"}
    ).get_json()

    response = drop(session, task["id"], bin_column["id"])

    assert response.get_json() == {"id": task["id"], "deleted": True}
    trash = session.get("/api/tasks/trash").get_json()["tasks"]
    assert [t["id"] for t in trash] == [task["id"]]


def test_dropping_reorders_inside_the_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    c, b, a = (add_task(session, project_id, name) for name in "cba")
    todo = column_named(session, project_id, "To Do")

    drop(session, c["id"], todo["id"], beforeId=a["id"])

    listing = session.get(f"/api/tasks?project={project_id}&sort_by=manual")
    assert [t["title"] for t in listing.get_json()["tasks"]] == ["c", "a", "b"]


def test_a_task_cannot_be_dropped_on_another_projects_column(
    session: FlaskClient,
) -> None:
    task = add_task(session, add_project(session), "one")
    other = column_named(session, add_project(session, "Other"), "Done")

    assert drop(session, task["id"], other["id"]).status_code == 400


def test_moving_a_task_to_another_project_unassigns_it(
    session: FlaskClient,
) -> None:
    project_id = add_project(session)
    done = column_named(session, project_id, "Done")
    task = add_task(session, project_id, "one", columnId=done["id"])
    other_id = add_project(session, "Other")

    moved = session.patch(f"/api/tasks/{task['id']}", json={"projectId": other_id})

    assert moved.get_json()["columnId"] is None


def test_dropping_on_unassigned_clears_the_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    done = column_named(session, project_id, "Done")
    task = add_task(session, project_id, "one", columnId=done["id"])

    response = session.post(
        f"/api/tasks/{task['id']}/board-move", json={"columnId": None}
    )

    assert response.status_code == 200
    assert response.get_json()["columnId"] is None


def test_deleting_a_column_moves_its_tasks(session: FlaskClient) -> None:
    project_id = add_project(session)
    todo = column_named(session, project_id, "To Do")
    task = add_task(session, project_id, "one", columnId=todo["id"])
    progress = column_named(session, project_id, "In Progress")

    deleted = session.delete(
        f"/api/columns/{todo['id']}", json={"moveToId": progress["id"]}
    )

    assert deleted.status_code == 200
    assert (
        session.get(f"/api/tasks/{task['id']}").get_json()["columnId"]
        == (progress["id"])
    )
    assert len(columns_of(session, project_id)) == 2


def test_deleting_needs_a_target_but_not_a_real_column(
    session: FlaskClient,
) -> None:
    project_id = add_project(session)
    ids = [c["id"] for c in columns_of(session, project_id)]

    assert session.delete(f"/api/columns/{ids[0]}", json={}).status_code == 400
    assert (
        session.delete(f"/api/columns/{ids[0]}", json={"moveToId": ids[0]}).status_code
        == 400
    )


def test_deleting_can_send_tasks_to_unassigned_even_the_last_column(
    session: FlaskClient,
) -> None:
    project_id = add_project(session)
    ids = [c["id"] for c in columns_of(session, project_id)]
    task = add_task(session, project_id, "one", columnId=ids[2])

    for column_id in ids:
        response = session.delete(f"/api/columns/{column_id}", json={"moveToId": None})
        assert response.status_code == 200

    assert columns_of(session, project_id) == []
    assert session.get(f"/api/tasks/{task['id']}").get_json()["columnId"] is None


def test_other_users_cannot_see_or_change_columns(
    session: FlaskClient, make_user: Any, login: Any
) -> None:
    project_id = add_project(session)
    column = columns_of(session, project_id)[0]
    make_user(email="other@example.com")
    other = login("other@example.com")

    assert other.get(f"/api/projects/{project_id}/columns").status_code == 404
    assert (
        other.patch(f"/api/columns/{column['id']}", json={"name": "x"}).status_code
        == 404
    )
