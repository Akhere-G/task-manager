from collections.abc import Callable

import pytest

from tests.mcp.helpers import REGISTRY, fail, run

pytestmark = pytest.mark.integration


def test_a_task_goes_through_its_whole_life(user_id: int) -> None:
    created = run(user_id, "create_task", title="Write report", priority=2)
    assert created["title"] == "Write report"
    assert created["priority"] == 2

    assert run(user_id, "get_task", id=created["id"])["title"] == "Write report"

    updated = run(
        user_id,
        "update_task",
        id=created["id"],
        title="Write the report",
        isCompleted=True,
    )
    assert updated["title"] == "Write the report"
    assert updated["isCompleted"] is True
    assert updated["priority"] == 2

    run(user_id, "delete_task", id=created["id"])
    assert run(user_id, "list_tasks")["tasks"] == []
    trashed = run(user_id, "list_trash")["tasks"]
    assert [task["id"] for task in trashed] == [created["id"]]

    run(user_id, "restore_task", id=created["id"])
    assert [t["id"] for t in run(user_id, "list_tasks")["tasks"]] == [created["id"]]


def test_tasks_can_be_filtered_and_paged(user_id: int) -> None:
    for priority in (1, 2, 3):
        run(user_id, "create_task", title=f"P{priority}", priority=priority)

    urgent = run(user_id, "list_tasks", priority="1,2")
    paged = run(user_id, "list_tasks", limit=2)
    searched = run(user_id, "list_tasks", q="P3")

    assert sorted(t["title"] for t in urgent["tasks"]) == ["P1", "P2"]
    assert len(paged["tasks"]) == 2
    assert paged["totalPages"] == 2
    assert [t["title"] for t in searched["tasks"]] == ["P3"]


def test_a_task_can_be_created_into_a_new_project_with_new_labels(
    user_id: int,
) -> None:
    created = run(
        user_id,
        "create_task",
        title="Ship it",
        projectName="Work / Website",
        labelNames=["urgent"],
    )

    assert created["projectId"] is not None
    assert len(created["labelIds"]) == 1


def test_the_sort_order_cannot_be_chosen(user_id: int) -> None:
    first = run(user_id, "create_task", title="A", sortOrder=999999)
    second = run(user_id, "create_task", title="B", sortOrder=1)

    assert first["sortOrder"] != 999999
    assert second["sortOrder"] != 1


def test_invalid_input_is_reported_as_a_tool_error(user_id: int) -> None:
    blank = fail(user_id, "create_task", title="")
    bad_priority = fail(user_id, "create_task", title="x", priority=9)
    no_id = fail(user_id, "update_task", title="x")
    half_range = fail(user_id, "create_task", title="x", startAt="2026-01-01T10:00:00Z")

    assert "title" in str(blank)
    assert "priority" in str(bad_priority)
    assert "id" in str(no_id)
    assert half_range["errors"]


def test_a_task_belonging_to_someone_else_looks_missing(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other_id = make_user("other@example.com")
    theirs = run(other_id, "create_task", title="Private")

    for name in ("get_task", "delete_task", "restore_task"):
        assert "No task" in str(fail(user_id, name, id=theirs["id"]))
    assert "No task" in str(fail(user_id, "update_task", id=theirs["id"], title="Mine"))
    assert run(user_id, "list_tasks")["tasks"] == []
    assert run(other_id, "get_task", id=theirs["id"])["title"] == "Private"


def test_every_task_tool_advertises_an_input_schema() -> None:
    schemas = {tool.name: tool.definition()["inputSchema"] for tool in REGISTRY}

    assert all(schema["type"] == "object" for schema in schemas.values())
    assert "q" in schemas["list_tasks"]["properties"]
    assert "sortOrder" not in schemas["create_task"]["properties"]
    assert schemas["update_task"]["required"] == ["id"]
    assert schemas["delete_task"]["required"] == ["id"]
