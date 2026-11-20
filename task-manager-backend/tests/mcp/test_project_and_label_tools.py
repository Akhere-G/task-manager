from collections.abc import Callable

import pytest

from tests.mcp.helpers import REGISTRY, fail, run

pytestmark = pytest.mark.integration


def test_a_project_goes_through_its_whole_life(user_id: int) -> None:
    work = run(user_id, "create_project", name="Work", colour="#ff0000")
    site = run(user_id, "create_project", name="Website", parentId=work["id"])
    assert site["parentId"] == work["id"]

    renamed = run(user_id, "update_project", id=work["id"], name="Job")
    assert renamed["name"] == "Job"
    assert renamed["colour"] == "#ff0000"
    assert run(user_id, "get_project", id=work["id"])["name"] == "Job"
    names = {p["name"] for p in run(user_id, "list_projects")["projects"]}
    assert names == {"Job", "Website"}

    run(user_id, "delete_project", id=work["id"])
    remaining = run(user_id, "list_projects")["projects"]
    assert [(p["name"], p["parentId"]) for p in remaining] == [("Website", None)]


def test_deleting_a_project_moves_its_tasks_to_the_inbox(user_id: int) -> None:
    project = run(user_id, "create_project", name="Work")
    task = run(user_id, "create_task", title="Report", projectId=project["id"])

    run(user_id, "delete_project", id=project["id"])

    assert run(user_id, "get_task", id=task["id"])["projectId"] is None


def test_project_rules_are_enforced(user_id: int) -> None:
    run(user_id, "create_project", name="Work")

    assert "name" in str(fail(user_id, "create_project", name="work"))
    assert "name" in str(fail(user_id, "create_project", name=""))
    assert "colour" in str(fail(user_id, "create_project", name="x", colour="red"))


def test_a_label_goes_through_its_whole_life(user_id: int) -> None:
    label = run(user_id, "create_label", name="urgent", colour="#ff0000")

    renamed = run(user_id, "update_label", id=label["id"], name="asap")
    assert renamed["name"] == "asap"
    assert renamed["colour"] == "#ff0000"
    assert [x["name"] for x in run(user_id, "list_labels")["labels"]] == ["asap"]

    task = run(user_id, "create_task", title="Call", labelIds=[label["id"]])
    assert task["labelIds"] == [label["id"]]

    run(user_id, "delete_label", id=label["id"])
    assert run(user_id, "list_labels")["labels"] == []
    assert run(user_id, "get_task", id=task["id"])["labelIds"] == []


def test_label_names_must_be_unique_and_valid(user_id: int) -> None:
    run(user_id, "create_label", name="urgent")

    assert "name" in str(fail(user_id, "create_label", name="URGENT"))
    assert "colour" in str(fail(user_id, "create_label", name="b", colour="red"))


def test_projects_and_labels_of_someone_else_look_missing(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other_id = make_user("other@example.com")
    project = run(other_id, "create_project", name="Theirs")
    label = run(other_id, "create_label", name="theirs")

    for name in ("get_project", "update_project", "delete_project"):
        assert "No project" in str(fail(user_id, name, id=project["id"], name="x"))
    for name in ("update_label", "delete_label"):
        assert "No label" in str(fail(user_id, name, id=label["id"], name="x"))
    assert run(user_id, "list_projects")["projects"] == []
    assert run(user_id, "list_labels")["labels"] == []


def test_deletes_of_projects_and_labels_are_flagged_destructive() -> None:
    hints = {tool.name: tool.definition()["annotations"] for tool in REGISTRY}

    assert hints["delete_project"]["destructiveHint"] is True
    assert hints["delete_label"]["destructiveHint"] is True
    assert hints["delete_task"]["destructiveHint"] is False
    assert hints["list_projects"]["readOnlyHint"] is True
    assert hints["create_label"]["readOnlyHint"] is False


def test_the_full_registry_advertises_valid_schemas() -> None:
    names = [tool.name for tool in REGISTRY]

    assert len(names) == len(set(names)) == 25
    for tool in REGISTRY:
        assert tool.definition()["inputSchema"]["type"] == "object"
