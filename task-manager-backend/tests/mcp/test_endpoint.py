from collections.abc import Callable

from flask import Flask
from flask.testing import FlaskClient

from tests.mcp.helpers import bearer, call_over_http, rpc


def test_the_endpoint_needs_a_valid_token(
    client: FlaskClient, make_token: Callable[..., str]
) -> None:
    make_token()

    missing = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    wrong = rpc(client, "tm_not-a-token", "ping")
    wrong_scheme = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
        headers={"Authorization": "Basic abc"},
    )

    for response in (missing, wrong, wrong_scheme):
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


def test_a_revoked_token_stops_working(
    client: FlaskClient, session: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token()
    assert rpc(client, token, "ping").status_code == 200

    token_id = session.get("/api/api-tokens").get_json()["tokens"][0]["id"]
    session.delete(f"/api/api-tokens/{token_id}")

    assert rpc(client, token, "ping").status_code == 401


def test_the_session_cookie_is_not_accepted_in_place_of_a_token(
    session: FlaskClient,
) -> None:
    response = session.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})

    assert response.status_code == 401


def test_get_is_not_allowed_and_does_not_serve_the_frontend(
    client: FlaskClient,
) -> None:
    response = client.get("/mcp")

    assert response.status_code == 405
    assert response.headers["Allow"] == "POST"


def test_browser_requests_are_refused(
    client: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token()

    response = rpc(client, token, "ping", headers={"Origin": "https://evil.example"})

    assert response.status_code == 403


def test_a_client_can_initialize_list_and_call_tools(
    client: FlaskClient, session: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token()

    init = rpc(client, token, "initialize", {"protocolVersion": "2025-06-18"})
    assert init.get_json()["result"]["protocolVersion"] == "2025-06-18"
    assert init.headers["Cache-Control"] == "no-store"

    notified = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        headers=bearer(token),
    )
    assert notified.status_code == 202
    assert notified.get_data() == b""

    tools = rpc(client, token, "tools/list").get_json()["result"]["tools"]
    assert len(tools) == 36

    result = call_over_http(client, token, "create_task", {"title": "From Claude"})
    assert result["isError"] is False
    created = session.get("/api/tasks").get_json()["tasks"]
    assert [task["title"] for task in created] == ["From Claude"]


def test_protocol_versions_are_checked_after_initialize(
    client: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token()
    old = {"MCP-Protocol-Version": "2025-03-26"}
    unknown = {"MCP-Protocol-Version": "1999-01-01"}

    assert rpc(client, token, "ping", headers=old).status_code == 200
    assert rpc(client, token, "ping", headers=unknown).status_code == 400
    assert rpc(client, token, "initialize", headers=unknown).status_code == 200


def test_bad_bodies_are_json_rpc_errors(
    client: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token()

    garbage = client.post("/mcp", data="not json", headers=bearer(token))
    batch = client.post("/mcp", json=[{"jsonrpc": "2.0"}], headers=bearer(token))

    assert garbage.status_code == 400
    assert garbage.get_json()["error"]["code"] == -32700
    assert batch.get_json()["error"]["code"] == -32600


def test_a_read_token_can_read_but_not_change(
    client: FlaskClient, make_token: Callable[..., str]
) -> None:
    token = make_token(scope="read")

    read = call_over_http(client, token, "list_tasks", {})
    write = call_over_http(client, token, "create_task", {"title": "Nope"})

    assert read["isError"] is False
    assert write["isError"] is True
    assert "read-only" in write["content"][0]["text"]


def test_the_rate_limit_is_per_token(
    app: Flask, client: FlaskClient, make_token: Callable[..., str]
) -> None:
    busy = make_token(name="busy")
    quiet = make_token(name="quiet")

    statuses = [rpc(client, busy, "ping").status_code for _ in range(121)]

    assert statuses[:120] == [200] * 120
    assert statuses[120] == 429
    assert rpc(client, quiet, "ping").status_code == 200
