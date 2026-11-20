import json
import logging
from typing import Any

from marshmallow import ValidationError

from app.errors import app_error_body, validation_error_body
from app.exceptions import AppError, InsufficientScope
from app.mcp.registry import Principal, Tool, ToolRegistry
from app.mcp.schemas import IdSchema

logger = logging.getLogger(__name__)

SUPPORTED_VERSIONS = ("2025-06-18", "2025-03-26")
LATEST_VERSION = SUPPORTED_VERSIONS[0]
DEFAULT_VERSION = "2025-03-26"
SERVER_INFO = {"name": "taskflow", "version": "1.0.0"}
INSTRUCTIONS = (
    "Manage the user's TaskFlow tasks, projects and labels. "
    "Dates are ISO 8601 in UTC. Deleting a project or label is permanent."
)

PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602


class JsonRpcError(Exception):
    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def parse_error_response() -> dict[str, Any]:
    return _error_response(None, PARSE_ERROR, "Parse error.")


def invalid_request_response() -> dict[str, Any]:
    return _error_response(None, INVALID_REQUEST, "Invalid request.")


def handle_message(
    message: object, principal: Principal, registry: ToolRegistry
) -> dict[str, Any] | None:
    if _is_response(message):
        return None
    if not isinstance(message, dict) or not _is_request(message):
        return invalid_request_response()
    if "id" not in message:
        return None
    try:
        result = _dispatch(
            message["method"], message.get("params"), principal, registry
        )
    except JsonRpcError as error:
        return _error_response(message["id"], error.code, error.message)
    return {"jsonrpc": "2.0", "id": message["id"], "result": result}


def _is_request(message: dict[str, Any]) -> bool:
    return message.get("jsonrpc") == "2.0" and isinstance(message.get("method"), str)


def _is_response(message: object) -> bool:
    return (
        isinstance(message, dict)
        and message.get("jsonrpc") == "2.0"
        and "method" not in message
        and ("result" in message or "error" in message)
    )


def _error_response(request_id: object, code: int, message: str) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def _dispatch(
    method: str, params: object, principal: Principal, registry: ToolRegistry
) -> dict[str, Any]:
    arguments = params if isinstance(params, dict) else {}
    match method:
        case "initialize":
            return _initialize(arguments)
        case "ping":
            return {}
        case "tools/list":
            return {"tools": [tool.definition() for tool in registry]}
        case "tools/call":
            return _call_tool(arguments, principal, registry)
        case _:
            raise JsonRpcError(METHOD_NOT_FOUND, f"Method not found: {method}")


def _initialize(params: dict[str, Any]) -> dict[str, Any]:
    requested = params.get("protocolVersion")
    version = requested if requested in SUPPORTED_VERSIONS else LATEST_VERSION
    return {
        "protocolVersion": version,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": SERVER_INFO,
        "instructions": INSTRUCTIONS,
    }


def _call_tool(
    params: dict[str, Any], principal: Principal, registry: ToolRegistry
) -> dict[str, Any]:
    name = params.get("name")
    arguments = params.get("arguments", {})
    if not isinstance(name, str) or not isinstance(arguments, dict):
        raise JsonRpcError(
            INVALID_PARAMS, "A tool name and object arguments are required."
        )
    tool = registry.get(name)
    if tool is None:
        raise JsonRpcError(INVALID_PARAMS, f"Unknown tool: {name}")
    try:
        return _tool_result(_run(tool, principal, arguments))
    except AppError as error:
        return _tool_error(app_error_body(error))
    except ValidationError as error:
        return _tool_error(validation_error_body(error))
    except Exception:
        logger.exception("Tool %s failed", name)
        return _tool_error({"error": "Something went wrong."})


def _run(tool: Tool, principal: Principal, arguments: dict[str, Any]) -> dict[str, Any]:
    if not principal.scope.allows(tool.scope):
        raise InsufficientScope()
    data = tool.input().load(arguments)
    if tool.takes_id:
        data["id"] = IdSchema().load(arguments)["id"]
    return tool.run(principal.user_id, data)


def _tool_result(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload)}],
        "structuredContent": payload,
        "isError": False,
    }


def _tool_error(body: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(body)}], "isError": True}
