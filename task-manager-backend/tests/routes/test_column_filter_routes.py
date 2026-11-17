import pytest
from flask.testing import FlaskClient

from tests.routes.test_column_routes import (
    add_project,
    add_task,
    column_named,
    drop,
)

pytestmark = pytest.mark.integration


def titles(session: FlaskClient, query: str) -> list[str]:
    response = session.get(f"/api/tasks?sort_by=manual&is_completed=all&{query}")
    assert response.status_code == 200, response.get_json()
    return [task["title"] for task in response.get_json()["tasks"]]


def test_tasks_are_filtered_by_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    in_progress = column_named(session, project_id, "In Progress")
    moved = add_task(session, project_id, "Moved")
    add_task(session, project_id, "Stays")
    drop(session, moved["id"], in_progress["id"])

    query = f"project={project_id}&column={in_progress['id']}"

    assert titles(session, query) == ["Moved"]


def test_unassigned_tasks_have_no_column(session: FlaskClient) -> None:
    project_id = add_project(session)
    in_progress = column_named(session, project_id, "In Progress")
    moved = add_task(session, project_id, "Moved")
    drop(session, moved["id"], in_progress["id"])

    unassigned = titles(session, f"project={project_id}&unassigned=true")

    assert "Moved" not in unassigned


def test_a_column_filter_pages_ten_at_a_time(session: FlaskClient) -> None:
    project_id = add_project(session)
    todo = column_named(session, project_id, "To Do")
    for number in range(11):
        task = add_task(session, project_id, f"Task {number}")
        drop(session, task["id"], todo["id"])

    page = session.get(
        f"/api/tasks?project={project_id}&column={todo['id']}"
        "&limit=10&page=2&sort_by=manual&is_completed=all"
    ).get_json()

    assert len(page["tasks"]) == 1
    assert (page["totalTasks"], page["totalPages"]) == (11, 2)


def test_a_column_filter_without_a_project_is_a_400(session: FlaskClient) -> None:
    assert session.get("/api/tasks?column=1").status_code == 400
