from collections.abc import Mapping

from app.mcp.registry import Principal
from app.services.api_token_service import resolve_api_token


def bearer_token(headers: Mapping[str, str]) -> str:
    scheme, _, value = headers.get("Authorization", "").partition(" ")
    return value.strip() if scheme.lower() == "bearer" else ""


def authenticate(headers: Mapping[str, str]) -> Principal:
    api_token = resolve_api_token(bearer_token(headers))
    return Principal(api_token.user_id, api_token.scope)
