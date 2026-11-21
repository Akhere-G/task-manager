from flask import Blueprint, Response, jsonify, request
from flask.typing import ResponseReturnValue

from app.constants import MCP_RATE_LIMIT
from app.errors import app_error_body
from app.exceptions import InvalidApiToken
from app.extensions import limiter
from app.mcp.auth import authenticate, bearer_token
from app.mcp.protocol import (
    DEFAULT_VERSION,
    SUPPORTED_VERSIONS,
    handle_message,
    parse_error_response,
)
from app.mcp.registry import ToolRegistry
from app.mcp.tools import TOOLS
from app.services.auth_service import hash_token

mcp_bp = Blueprint("mcp", __name__)
registry = ToolRegistry(TOOLS)


def _token_key() -> str:
    return f"mcp:{hash_token(bearer_token(request.headers))}"


def _unauthorized(error: InvalidApiToken) -> Response:
    response = jsonify(app_error_body(error))
    response.status_code = error.status_code
    response.headers["WWW-Authenticate"] = "Bearer"
    return response


def _unsupported_version(message: object) -> bool:
    is_initialize = isinstance(message, dict) and message.get("method") == "initialize"
    version = request.headers.get("MCP-Protocol-Version", DEFAULT_VERSION)
    return not is_initialize and version not in SUPPORTED_VERSIONS


@mcp_bp.route("/mcp", methods=["POST"])
@limiter.limit(MCP_RATE_LIMIT, key_func=_token_key)
def endpoint() -> ResponseReturnValue:
    if "Origin" in request.headers:
        return jsonify({"error": "Browser requests are not allowed."}), 403
    try:
        principal = authenticate(request.headers)
    except InvalidApiToken as error:
        return _unauthorized(error)

    message = request.get_json(silent=True)
    if message is None:
        return jsonify(parse_error_response()), 400
    if _unsupported_version(message):
        return jsonify({"error": "Unsupported MCP protocol version."}), 400

    response = handle_message(message, principal, registry)
    return Response(status=202) if response is None else jsonify(response)
