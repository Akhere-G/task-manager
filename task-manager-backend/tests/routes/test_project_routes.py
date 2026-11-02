from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def add_project(session: FlaskClient, name: str, **extra: Any) -> dict[str, Any]:
    response = session.post("/api/projects", json={"name": name, **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_projects_can_be_created_listed_renamed_and_deleted(
    session: FlaskClient,
) -> None:
    project = add_project(session, "Work", colour="#ff0000")
    assert project["parentId"] is None and project["colour"] == "#ff0000"

    edited = session.patch(f"/api/projects/{project['id']}", json={"name": "Job"})
    assert edited.get_json()["name"] == "Job"
    assert [p["name"] for p in session.get("/api/projects").get_json()["projects"]] == [
        "Job"
    ]

    assert session.delete(f"/api/projects/{project['id']}").status_code == 200
    assert session.get("/api/projects").get_json()["projects"] == []


def test_a_bad_colour_or_blank_name_is_rejected(session: FlaskClient) -> None:
    assert (
        session.post("/api/projects", json={"name": "A", "colour": "red"}).status_code
        == 400
    )
    assert session.post("/api/projects", json={"name": "  "}).status_code == 400


def test_names_are_unique_per_parent_ignoring_case(session: FlaskClient) -> None:
    work = add_project(session, "Work")
    add_project(session, "Plans", parentId=work["id"])

    assert session.post("/api/projects", json={"name": "work"}).status_code == 409
    clash = session.post(
        "/api/projects", json={"name": "PLANS", "parentId": work["id"]}
    )
    assert clash.status_code == 409
    add_project(session, "Plans")


def test_projects_nest_three_levels_and_no_deeper(session: FlaskClient) -> None:
    first = add_project(session, "One")
    second = add_project(session, "Two", parentId=first["id"])
    third = add_project(session, "Three", parentId=second["id"])

    too_deep = session.post(
        "/api/projects", json={"name": "Four", "parentId": third["id"]}
    )
    assert too_deep.status_code == 400
    assert "parentId" in too_deep.get_json()["errors"]


def test_moving_a_subtree_cannot_exceed_the_depth_limit(session: FlaskClient) -> None:
    a = add_project(session, "A")
    b = add_project(session, "B", parentId=a["id"])
    add_project(session, "C", parentId=b["id"])
    other = add_project(session, "Other")
    leaf = add_project(session, "Leaf", parentId=other["id"])

    response = session.patch(f"/api/projects/{a['id']}", json={"parentId": leaf["id"]})

    assert response.status_code == 400


def test_a_project_cannot_become_its_own_descendant(session: FlaskClient) -> None:
    parent = add_project(session, "Parent")
    child = add_project(session, "Child", parentId=parent["id"])

    own = session.patch(
        f"/api/projects/{parent['id']}", json={"parentId": parent["id"]}
    )
    loop = session.patch(
        f"/api/projects/{parent['id']}", json={"parentId": child["id"]}
    )

    assert own.status_code == 400 and loop.status_code == 400


def test_deleting_a_project_moves_tasks_to_inbox_and_children_up(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    grandparent = add_project(session, "Top")
    middle = add_project(session, "Middle", parentId=grandparent["id"])
    child = add_project(session, "Child", parentId=middle["id"])
    task = session.post(
        "/api/tasks", json=task_payload(projectId=middle["id"])
    ).get_json()

    session.delete(f"/api/projects/{middle['id']}")

    projects = {
        p["name"]: p for p in session.get("/api/projects").get_json()["projects"]
    }
    assert projects["Child"]["parentId"] == grandparent["id"]
    assert child["id"] == projects["Child"]["id"]
    assert session.get(f"/api/tasks/{task['id']}").get_json()["projectId"] is None


def test_a_task_needs_an_existing_project(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    response = session.post("/api/tasks", json=task_payload(projectId=9999))

    assert response.status_code == 400
    assert "projectId" in response.get_json()["errors"]


def test_filtering_by_a_project_includes_its_sub_projects(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    work = add_project(session, "Work")
    reports = add_project(session, "Reports", parentId=work["id"])
    home = add_project(session, "Home")
    for title, project in (("a", work), ("b", reports), ("c", home)):
        session.post(
            "/api/tasks", json=task_payload(title=title, projectId=project["id"])
        )

    def titles(project_id: int) -> list[str]:
        tasks = session.get(f"/api/tasks?project={project_id}").get_json()["tasks"]
        return sorted(task["title"] for task in tasks)

    assert titles(work["id"]) == ["a", "b"]
    assert titles(reports["id"]) == ["b"]
    assert titles(home["id"]) == ["c"]
