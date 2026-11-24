from collections.abc import Callable
from typing import Any

import pytest

from tests.mcp.helpers import REGISTRY, fail, run

pytestmark = pytest.mark.integration


def columns_of(user_id: int, project_id: int) -> dict[str, dict[str, Any]]:
    columns = run(user_id, "list_columns", projectId=project_id)["columns"]
    return {column["name"]: column for column in columns}


@pytest.fixture
def project_id(user_id: int) -> int:
    return run(user_id, "create_project", name="Work")["id"]


def test_a_new_project_starts_with_the_default_columns(
    user_id: int, project_id: int
) -> None:
    columns = run(user_id, "list_columns", projectId=project_id)["columns"]

    assert [column["name"] for column in columns] == ["To Do", "In Progress", "Done"]
    assert {column["projectId"] for column in columns} == {project_id}


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

    run(user_id, "delete_column", id=review["id"], moveToId=None)
    assert "QA" not in columns_of(user_id, project_id)


def test_column_names_are_unique_ignoring_case(user_id: int, project_id: int) -> None:
    assert "name" in str(
        fail(user_id, "create_column", projectId=project_id, name="to do")
    )
    assert "colour" in str(
        fail(user_id, "create_column", projectId=project_id, name="x", colour="red")
    )


def test_columns_can_be_reordered(user_id: int, project_id: int) -> None:
    columns = columns_of(user_id, project_id)
    ids = [columns[name]["id"] for name in ("Done", "To Do", "In Progress")]

    reordered = run(user_id, "reorder_columns", projectId=project_id, columnIds=ids)

    assert [column["id"] for column in reordered["columns"]] == ids
    assert list(columns_of(user_id, project_id)) == ["Done", "To Do", "In Progress"]


def test_deleting_a_column_keeps_its_tasks(user_id: int, project_id: int) -> None:
    columns = columns_of(user_id, project_id)
    task = run(
        user_id,
        "create_task",
        title="Report",
        projectId=project_id,
        columnId=columns["In Progress"]["id"],
    )

    run(
        user_id,
        "delete_column",
        id=columns["In Progress"]["id"],
        moveToId=columns["Done"]["id"],
    )
    assert run(user_id, "get_task", id=task["id"])["columnId"] == columns["Done"]["id"]

    run(user_id, "delete_column", id=columns["Done"]["id"], moveToId=None)
    assert run(user_id, "get_task", id=task["id"])["columnId"] is None


def test_a_deleted_column_needs_a_destination(user_id: int, project_id: int) -> None:
    columns = columns_of(user_id, project_id)

    assert "moveToId" in str(fail(user_id, "delete_column", id=columns["Done"]["id"]))
    other = run(user_id, "create_project", name="Other")
    elsewhere = columns_of(user_id, other["id"])["To Do"]["id"]
    fail(user_id, "delete_column", id=columns["Done"]["id"], moveToId=elsewhere)


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


def test_a_delete_column_sends_the_task_to_the_trash(
    user_id: int, project_id: int
) -> None:
    bin_column = run(
        user_id,
        "create_column",
        projectId=project_id,
        name="Bin",
        onDrop="delete",
    )
    task = run(user_id, "create_task", title="Junk", projectId=project_id)

    result = run(
        user_id, "move_task_to_column", id=task["id"], columnId=bin_column["id"]
    )

    assert result == {"id": task["id"], "deleted": True}
    trashed = run(user_id, "list_trash")["tasks"]
    assert [item["id"] for item in trashed] == [task["id"]]


def test_inbox_tasks_cannot_be_moved_to_a_column(user_id: int, project_id: int) -> None:
    column_id = columns_of(user_id, project_id)["Done"]["id"]
    task = run(user_id, "create_task", title="Loose")

    fail(user_id, "move_task_to_column", id=task["id"], columnId=column_id)


def test_columns_of_someone_else_look_missing(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other_id = make_user("other@example.com")
    theirs = run(other_id, "create_project", name="Theirs")
    column_id = columns_of(other_id, theirs["id"])["Done"]["id"]

    assert "No project" in str(fail(user_id, "list_columns", projectId=theirs["id"]))
    assert "No column" in str(fail(user_id, "update_column", id=column_id, name="x"))
    assert "No column" in str(
        fail(user_id, "delete_column", id=column_id, moveToId=None)
    )


def test_column_tools_are_annotated() -> None:
    hints = {tool.name: tool.definition()["annotations"] for tool in REGISTRY}

    assert hints["list_columns"]["readOnlyHint"] is True
    assert hints["delete_column"]["destructiveHint"] is True
    assert hints["update_column"]["idempotentHint"] is True
    assert hints["reorder_columns"]["idempotentHint"] is True
    assert hints["move_task_to_column"]["destructiveHint"] is False
