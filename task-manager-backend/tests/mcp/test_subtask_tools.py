from collections.abc import Callable

import pytest

from tests.mcp.helpers import REGISTRY, fail, run

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


def test_more_subtasks_go_to_the_end(user_id: int, parent_id: int) -> None:
    run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "One"}])

    added = run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Two"}])

    assert titles(run(user_id, "get_task", id=parent_id)["subtasks"]) == ["One", "Two"]
    assert added["subtasks"][0]["position"] == 1


def test_a_subtask_is_completed_with_update_task(user_id: int, parent_id: int) -> None:
    subtask = run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Pack"}])[
        "subtasks"
    ][0]

    run(user_id, "update_task", id=subtask["id"], isCompleted=True)

    stored = run(user_id, "get_task", id=parent_id)["subtasks"][0]
    assert stored["isCompleted"] is True


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


def test_reordering_must_list_every_subtask_once(user_id: int, parent_id: int) -> None:
    added = run(
        user_id,
        "add_subtasks",
        id=parent_id,
        subtasks=[{"title": "A"}, {"title": "B"}],
    )["subtasks"]

    fail(user_id, "reorder_subtasks", id=parent_id, ids=[added[0]["id"]])


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


def test_a_failed_replace_keeps_the_old_subtasks(user_id: int, parent_id: int) -> None:
    run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Keep"}])

    fail(user_id, "replace_subtasks", id=parent_id, subtasks=[{"title": ""}])

    assert titles(run(user_id, "get_task", id=parent_id)["subtasks"]) == ["Keep"]


def test_subtasks_need_a_title_and_at_least_one_entry(
    user_id: int, parent_id: int
) -> None:
    assert "subtasks" in str(fail(user_id, "add_subtasks", id=parent_id, subtasks=[]))
    assert "title" in str(
        fail(user_id, "add_subtasks", id=parent_id, subtasks=[{"priority": 2}])
    )


def test_a_subtask_cannot_have_subtasks(user_id: int, parent_id: int) -> None:
    subtask = run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Pack"}])[
        "subtasks"
    ][0]

    fail(user_id, "add_subtasks", id=subtask["id"], subtasks=[{"title": "Deeper"}])


def test_deleting_a_subtask_is_permanent(user_id: int, parent_id: int) -> None:
    subtask = run(user_id, "add_subtasks", id=parent_id, subtasks=[{"title": "Pack"}])[
        "subtasks"
    ][0]

    run(user_id, "delete_task", id=subtask["id"])

    assert run(user_id, "get_task", id=parent_id)["subtasks"] == []
    assert run(user_id, "list_trash")["tasks"] == []


def test_subtasks_of_someone_else_look_missing(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other_id = make_user("other@example.com")
    theirs = run(other_id, "create_task", title="Theirs")["id"]

    for tool, arguments in (
        ("add_subtasks", {"subtasks": [{"title": "x"}]}),
        ("replace_subtasks", {"subtasks": [{"title": "x"}]}),
        ("reorder_subtasks", {"ids": []}),
    ):
        assert "No task" in str(fail(user_id, tool, id=theirs, **arguments))


def test_subtask_tools_are_annotated() -> None:
    hints = {tool.name: tool.definition()["annotations"] for tool in REGISTRY}

    assert hints["replace_subtasks"]["destructiveHint"] is True
    assert hints["add_subtasks"]["destructiveHint"] is False
    assert hints["reorder_subtasks"]["idempotentHint"] is True
