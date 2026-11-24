import pytest

from tests.mcp.helpers import fail, run

pytestmark = pytest.mark.integration


def titles(subtasks: list[dict]) -> list[str]:
    return [subtask["title"] for subtask in subtasks]


@pytest.fixture
def parent_id(user_id: int) -> int:
    return run(user_id, "create_task", title="Trip")["id"]


def test_added_subtasks_show_on_the_task_but_not_in_lists(
    user_id: int, parent_id: int
) -> None:
    added = run(
        user_id,
        "add_subtasks",
        id=parent_id,
        subtasks=[{"title": "Book flights", "priority": 1}, {"title": "Pack"}],
    )

    assert titles(added["subtasks"]) == ["Book flights", "Pack"]
    assert added["subtasks"][0]["parentId"] == parent_id
    assert titles(run(user_id, "get_task", id=parent_id)["subtasks"]) == [
        "Book flights",
        "Pack",
    ]
    listed = run(user_id, "list_tasks")["tasks"]
    assert [task["title"] for task in listed] == ["Trip"]


def test_subtasks_can_be_reordered(user_id: int, parent_id: int) -> None:
    added = run(
        user_id,
        "add_subtasks",
        id=parent_id,
        subtasks=[{"title": "A"}, {"title": "B"}, {"title": "C"}],
    )["subtasks"]
    ids = [subtask["id"] for subtask in reversed(added)]

    reordered = run(user_id, "reorder_subtasks", id=parent_id, ids=ids)

    assert titles(reordered["subtasks"]) == ["C", "B", "A"]


def test_replacing_subtasks_removes_the_old_ones_for_good(
    user_id: int, parent_id: int
) -> None:
    old = run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Old"}])[
        "subtasks"
    ][0]

    replaced = run(
        user_id, "replace_subtasks", id=parent_id, subtasks=[{"title": "New"}]
    )

    assert titles(replaced["subtasks"]) == ["New"]
    assert "No task" in str(fail(user_id, "get_task", id=old["id"]))
