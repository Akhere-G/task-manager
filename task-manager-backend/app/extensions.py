import hashlib

from flask import request
from flask_limiter import Limiter


def client_ip():
    return request.remote_addr or "unknown"


def _fingerprint(value):
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def _json_email():
    data = request.get_json(silent=True)
    email = data.get("email") if isinstance(data, dict) else None
    return email if isinstance(email, str) and email.strip() else ""


def ip_and_email():
    return f"{client_ip()}:{_fingerprint(_json_email())}"


def email_only():
    return _fingerprint(_json_email())


limiter = Limiter(
    key_func=client_ip,
    default_limits=["300 per minute"],
    headers_enabled=True,
)
