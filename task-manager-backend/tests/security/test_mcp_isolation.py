from collections.abc import Callable

from flask.testing import FlaskClient

from tests.mcp.helpers import call_over_http


def token_for(session: FlaskClient, scope: str = "write") -> str:
    response = session.post("/api/api-tokens", json={"name": "t", "scope": scope})
    return response.get_json()["token"]


def test_a_token_only_reaches_its_owners_data(
    client: FlaskClient,
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    token_a = token_for(login("a@example.com"))
    token_b = token_for(login("b@example.com"))
    task = call_over_http(client, token_a, "create_task", {"title": "Private"})
    task_id = task["structuredContent"]["id"]
    project = call_over_http(client, token_a, "create_project", {"name": "Mine"})
    label = call_over_http(client, token_a, "create_label", {"name": "mine"})

    assert (
        call_over_http(client, token_b, "list_tasks", {})["structuredContent"]["tasks"]
        == []
    )
    for tool, arguments in (
        ("get_task", {"id": task_id}),
        ("update_task", {"id": task_id, "title": "Hijacked"}),
        ("delete_task", {"id": task_id}),
        ("update_project", {"id": project["structuredContent"]["id"], "name": "x"}),
        ("delete_project", {"id": project["structuredContent"]["id"]}),
        ("update_label", {"id": label["structuredContent"]["id"], "name": "x"}),
        ("delete_label", {"id": label["structuredContent"]["id"]}),
    ):
        assert call_over_http(client, token_b, tool, arguments)["isError"] is True

    mine = call_over_http(client, token_a, "get_task", {"id": task_id})
    assert mine["structuredContent"]["title"] == "Private"


def test_user_ids_in_arguments_are_ignored(
    client: FlaskClient,
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
) -> None:
    victim_id = make_user("victim@example.com")
    make_user("attacker@example.com")
    token = token_for(login("attacker@example.com"))

    created = call_over_http(
        client, token, "create_task", {"title": "x", "userId": victim_id}
    )

    assert created["structuredContent"]["userId"] != victim_id


def test_columns_subtasks_and_stats_stay_private(
    client: FlaskClient,
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    token_a = token_for(login("a@example.com"))
    token_b = token_for(login("b@example.com"))

    def call(token: str, tool: str, arguments: dict) -> dict:
        return call_over_http(client, token, tool, arguments)

    project = call(token_a, "create_project", {"name": "Mine"})["structuredContent"]
    columns = call(token_a, "list_columns", {"projectId": project["id"]})[
        "structuredContent"
    ]["columns"]
    column_id = columns[0]["id"]
    task = call(
        token_a, "create_task", {"title": "Private", "projectId": project["id"]}
    )["structuredContent"]
    call(token_a, "add_subtasks", {"id": task["id"], "subtasks": [{"title": "Step"}]})
    call(token_a, "update_task", {"id": task["id"], "isCompleted": True})

    for tool, arguments in (
        ("list_columns", {"projectId": project["id"]}),
        ("create_column", {"projectId": project["id"], "name": "Mine"}),
        ("update_column", {"id": column_id, "name": "x"}),
        ("reorder_columns", {"projectId": project["id"], "columnIds": [column_id]}),
        ("delete_column", {"id": column_id, "moveToId": None}),
        ("move_task_to_column", {"id": task["id"], "columnId": column_id}),
        ("add_subtasks", {"id": task["id"], "subtasks": [{"title": "x"}]}),
        ("replace_subtasks", {"id": task["id"], "subtasks": [{"title": "x"}]}),
        ("reorder_subtasks", {"id": task["id"], "ids": []}),
    ):
        assert call(token_b, tool, arguments)["isError"] is True, tool

    health = call(token_b, "get_backlog_health", {})["structuredContent"]
    assert [row["count"] for row in health["backlogHealth"]] == [0, 0, 0]
    assert call(token_b, "get_project_volume", {})["structuredContent"] == {
        "projectVolume": []
    }
    mine = call(token_a, "get_task", {"id": task["id"]})["structuredContent"]
    assert [subtask["title"] for subtask in mine["subtasks"]] == ["Step"]
    assert (
        len(
            call(token_a, "list_columns", {"projectId": project["id"]})[
                "structuredContent"
            ]["columns"]
        )
        == 3
    )
