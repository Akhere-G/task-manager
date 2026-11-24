import pytest

from tests.mcp.helpers import fail, run

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

    assert run(user_id, "delete_task", id=created["id"])["message"] == "Deleted"
    assert run(user_id, "delete_task", id=created["id"])["message"] == (
        "Already in the trash"
    )
    assert run(user_id, "list_tasks")["tasks"] == []
    trashed = run(user_id, "list_trash")["tasks"]
    assert [task["id"] for task in trashed] == [created["id"]]

    assert run(user_id, "restore_task", id=created["id"])["message"] == "Restored"
    assert run(user_id, "restore_task", id=created["id"])["message"] == (
        "Was not in the trash"
    )
    assert [t["id"] for t in run(user_id, "list_tasks")["tasks"]] == [created["id"]]


def test_invalid_input_is_reported_as_a_tool_error(user_id: int) -> None:
    blank = fail(user_id, "create_task", title="")
    bad_priority = fail(user_id, "create_task", title="x", priority=9)
    no_id = fail(user_id, "update_task", title="x")
    half_range = fail(user_id, "create_task", title="x", startAt="2026-01-01T10:00:00Z")

    assert "title" in str(blank)
    assert "priority" in str(bad_priority)
    assert "id" in str(no_id)
    assert half_range["errors"]
