from dataclasses import replace
from typing import Any

import pytest
from marshmallow import fields, validate

from app.exceptions import LabelNotFound
from app.mcp.protocol import (
    INVALID_PARAMS,
    INVALID_REQUEST,
    LATEST_VERSION,
    METHOD_NOT_FOUND,
    handle_message,
)
from app.mcp.registry import Principal, Tool, ToolRegistry
from app.models import TokenScope
from app.schemas.base import CamelSchema

pytestmark = pytest.mark.unit

READER = Principal(user_id=7, scope=TokenScope.READ)
WRITER = Principal(user_id=7, scope=TokenScope.WRITE)


class EchoInput(CamelSchema):
    word = fields.String(required=True, validate=validate.Length(min=1, max=5))


def echo(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return {"user": user_id, "word": data["word"]}


def echo_with_id(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return {"id": data["id"], "word": data["word"]}


def missing(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    raise LabelNotFound()


def crash(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    raise RuntimeError("secret detail")


def tool(name: str, run: Any, scope: TokenScope = TokenScope.READ) -> Tool:
    return Tool(name, name.title(), "A test tool.", EchoInput, scope, run)


REGISTRY = ToolRegistry(
    [
        tool("echo", echo),
        tool("missing", missing),
        tool("crash", crash),
        tool("change", echo, scope=TokenScope.WRITE),
        replace(tool("byid", echo_with_id), takes_id=True),
    ]
)


def request(method: str, params: Any = None, request_id: int = 1) -> dict[str, Any]:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        message["params"] = params
    return message


def call(name: str, arguments: Any, principal: Principal = READER) -> dict[str, Any]:
    response = handle_message(
        request("tools/call", {"name": name, "arguments": arguments}),
        principal,
        REGISTRY,
    )
    assert response is not None
    return response["result"]


def test_initialize_negotiates_a_supported_version() -> None:
    response = handle_message(
        request("initialize", {"protocolVersion": "2025-03-26"}), READER, REGISTRY
    )

    assert response["result"]["protocolVersion"] == "2025-03-26"
    assert response["result"]["capabilities"] == {"tools": {"listChanged": False}}
    assert response["result"]["serverInfo"]["name"] == "taskflow"


def test_initialize_falls_back_to_the_latest_version() -> None:
    response = handle_message(
        request("initialize", {"protocolVersion": "1999-01-01"}), READER, REGISTRY
    )

    assert response["result"]["protocolVersion"] == LATEST_VERSION


def test_ping_answers_with_an_empty_result() -> None:
    assert handle_message(request("ping"), READER, REGISTRY)["result"] == {}


def test_notifications_and_responses_get_no_reply() -> None:
    notification = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    response = {"jsonrpc": "2.0", "id": 4, "result": {}}

    assert handle_message(notification, READER, REGISTRY) is None
    assert handle_message(response, READER, REGISTRY) is None


@pytest.mark.parametrize("message", [[], "ping", {"method": "ping", "id": 1}, {}])
def test_malformed_messages_are_invalid_requests(message: object) -> None:
    response = handle_message(message, READER, REGISTRY)

    assert response["error"]["code"] == INVALID_REQUEST
    assert response["id"] is None


def test_an_unknown_method_is_reported_with_the_request_id() -> None:
    response = handle_message(request("nope", request_id=9), READER, REGISTRY)

    assert response["id"] == 9
    assert response["error"]["code"] == METHOD_NOT_FOUND


def test_tools_list_describes_every_tool_with_hints() -> None:
    result = handle_message(request("tools/list"), READER, REGISTRY)["result"]

    by_name = {entry["name"]: entry for entry in result["tools"]}
    assert set(by_name) == {"echo", "missing", "crash", "change", "byid"}
    assert by_name["echo"]["inputSchema"]["required"] == ["word"]
    assert by_name["echo"]["annotations"]["readOnlyHint"] is True
    assert by_name["change"]["annotations"]["readOnlyHint"] is False


def test_a_tool_call_returns_text_and_structured_content() -> None:
    result = call("echo", {"word": "hi"})

    assert result["isError"] is False
    assert result["structuredContent"] == {"user": 7, "word": "hi"}
    assert '"word": "hi"' in result["content"][0]["text"]


def test_a_tool_that_takes_an_id_gets_it_validated_and_passed_in() -> None:
    result = call("byid", {"id": 5, "word": "hi"})
    missing_id = call("byid", {"word": "hi"})
    bad_id = call("byid", {"id": "x", "word": "hi"})

    assert result["structuredContent"] == {"id": 5, "word": "hi"}
    assert missing_id["isError"] and "id" in missing_id["content"][0]["text"]
    assert bad_id["isError"] and "id" in bad_id["content"][0]["text"]


def test_the_user_comes_from_the_principal_not_the_arguments() -> None:
    result = call("echo", {"word": "hi", "userId": 99, "user_id": 99})

    assert result["structuredContent"]["user"] == 7


def test_invalid_arguments_are_a_tool_error_naming_the_field() -> None:
    result = call("echo", {"word": "far too long"})

    assert result["isError"] is True
    assert "word" in result["content"][0]["text"]


def test_app_errors_are_a_tool_error_with_their_message() -> None:
    result = call("missing", {"word": "hi"})

    assert result["isError"] is True
    assert "No label with that id exists." in result["content"][0]["text"]


def test_unexpected_errors_do_not_leak_details() -> None:
    result = call("crash", {"word": "hi"})

    assert result["isError"] is True
    assert "secret detail" not in result["content"][0]["text"]


def test_a_read_token_cannot_call_a_write_tool_but_a_write_token_can() -> None:
    refused = call("change", {"word": "hi"}, READER)
    allowed = call("change", {"word": "hi"}, WRITER)

    assert refused["isError"] is True
    assert "read-only" in refused["content"][0]["text"]
    assert allowed["isError"] is False


def test_unknown_tools_and_bad_params_are_protocol_errors() -> None:
    unknown = handle_message(
        request("tools/call", {"name": "nope", "arguments": {}}), READER, REGISTRY
    )
    bad = handle_message(request("tools/call", {"arguments": []}), READER, REGISTRY)

    assert unknown["error"]["code"] == INVALID_PARAMS
    assert bad["error"]["code"] == INVALID_PARAMS


def test_duplicate_tool_names_are_rejected() -> None:
    with pytest.raises(ValueError, match="Duplicate"):
        ToolRegistry([tool("echo", echo), tool("echo", echo)])
