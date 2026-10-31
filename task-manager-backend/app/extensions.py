import hashlib

from flask import request
from flask_jwt_extended import get_jwt_identity
from flask_limiter import Limiter

from app import config
from app.services.auth_service import is_demo_user


def client_ip() -> str:
    return request.remote_addr or "unknown"


def _fingerprint(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def _json_email() -> str:
    data = request.get_json(silent=True)
    email = data.get("email") if isinstance(data, dict) else None
    return email if isinstance(email, str) and email.strip() else ""


def ip_and_email() -> str:
    return f"{client_ip()}:{_fingerprint(_json_email())}"


def email_only() -> str:
    return _fingerprint(_json_email())


def user_key() -> str:
    return f"user:{get_jwt_identity()}"


def ai_daily_limit() -> str:
    limit = (
        config.AI_DAILY_LIMIT_DEMO
        if is_demo_user(get_jwt_identity())
        else config.AI_DAILY_LIMIT
    )
    return f"{limit} per day"


limiter = Limiter(
    key_func=client_ip,
    default_limits=["300 per minute"],
    headers_enabled=True,
)
