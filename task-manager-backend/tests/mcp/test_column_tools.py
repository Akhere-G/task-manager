from typing import Any

import pytest

from tests.mcp.helpers import run

pytestmark = pytest.mark.integration


def columns_of(user_id: int, project_id: int) -> dict[str, dict[str, Any]]:
    columns = run(user_id, "list_columns", projectId=project_id)["columns"]
    return {column["name"]: column for column in columns}


@pytest.fixture
def project_id(user_id: int) -> int:
    return run(user_id, "create_project", name="Work")["id"]


def test_a_column_goes_through_its_whole_life(user_id: int, project_id: int) -> None:
    review = run(
        user_id,
        "create_column",
        projectId=project_id,
        name="Review",
        colour="#ff0000",
        onDrop="uncomplete",
    )
    assert review["position"] == 3

    renamed = run(user_id, "update_column", id=review["id"], name="QA")
    assert renamed["name"] == "QA"
    assert renamed["colour"] == "#ff0000"
    assert "QA" in columns_of(user_id, project_id)

    columns = columns_of(user_id, project_id)
    ids = [columns[name]["id"] for name in ("Done", "To Do", "In Progress", "QA")]
    reordered = run(user_id, "reorder_columns", projectId=project_id, columnIds=ids)
    assert [column["id"] for column in reordered["columns"]] == ids

    run(user_id, "delete_column", id=review["id"], moveToId=None)
    assert "QA" not in columns_of(user_id, project_id)


def test_columns_can_be_reordered(user_id: int, project_id: int) -> None:
    columns = columns_of(user_id, project_id)
    ids = [columns[name]["id"] for name in ("Done", "To Do", "In Progress")]

    reordered = run(user_id, "reorder_columns", projectId=project_id, columnIds=ids)

    assert [column["id"] for column in reordered["columns"]] == ids
    assert list(columns_of(user_id, project_id)) == ["Done", "To Do", "In Progress"]


def test_moving_a_task_runs_the_columns_drop_action(
    user_id: int, project_id: int
) -> None:
    columns = columns_of(user_id, project_id)
    task = run(user_id, "create_task", title="Report", projectId=project_id)

    done = run(
        user_id, "move_task_to_column", id=task["id"], columnId=columns["Done"]["id"]
    )
    assert done["columnId"] == columns["Done"]["id"]
    assert done["isCompleted"] is True

    reopened = run(
        user_id, "move_task_to_column", id=task["id"], columnId=columns["To Do"]["id"]
    )
    assert reopened["isCompleted"] is False

    unassigned = run(user_id, "move_task_to_column", id=task["id"], columnId=None)
    assert unassigned["columnId"] is None
