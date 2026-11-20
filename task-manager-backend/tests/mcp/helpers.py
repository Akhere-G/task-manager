import json
from typing import Any

from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from app.mcp.protocol import handle_message
from app.mcp.registry import Principal, ToolRegistry
from app.mcp.tools import TOOLS
from app.models import TokenScope

REGISTRY = ToolRegistry(TOOLS)


def call_tool(
    registry: ToolRegistry,
    user_id: int,
    name: str,
    arguments: dict[str, Any],
    scope: TokenScope = TokenScope.WRITE,
) -> tuple[bool, dict[str, Any]]:
    message = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    response = handle_message(message, Principal(user_id, scope), registry)
    assert response is not None
    result = response["result"]
    payload = result.get("structuredContent") or json.loads(
        result["content"][0]["text"]
    )
    return result["isError"], payload


def run(user_id: int, tool: str, /, **arguments: Any) -> dict[str, Any]:
    is_error, payload = call_tool(REGISTRY, user_id, tool, arguments)
    assert not is_error, payload
    return payload


def fail(user_id: int, tool: str, /, **arguments: Any) -> dict[str, Any]:
    is_error, payload = call_tool(REGISTRY, user_id, tool, arguments)
    assert is_error, payload
    return payload


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def rpc(
    client: FlaskClient,
    token: str,
    method: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> TestResponse:
    body: dict[str, Any] = {"jsonrpc": "2.0", "id": 1, "method": method}
    if params is not None:
        body["params"] = params
    return client.post("/mcp", json=body, headers={**bearer(token), **(headers or {})})


def call_over_http(
    client: FlaskClient, token: str, tool: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    response = rpc(client, token, "tools/call", {"name": tool, "arguments": arguments})
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()["result"]
