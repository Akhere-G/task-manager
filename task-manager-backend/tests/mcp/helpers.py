import json
from typing import Any

from app.mcp.protocol import handle_message
from app.mcp.registry import Principal, ToolRegistry
from app.mcp.tools.labels import LABEL_TOOLS
from app.mcp.tools.projects import PROJECT_TOOLS
from app.mcp.tools.tasks import TASK_TOOLS
from app.models import TokenScope

REGISTRY = ToolRegistry([*TASK_TOOLS, *PROJECT_TOOLS, *LABEL_TOOLS])


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
