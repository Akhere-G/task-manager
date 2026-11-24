import pytest

from tests.mcp.helpers import run

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
    assert remaining == []


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
