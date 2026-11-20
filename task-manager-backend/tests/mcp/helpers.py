import json
from typing import Any

from app.mcp.protocol import handle_message
from app.mcp.registry import Principal, ToolRegistry
from app.models import TokenScope


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
