from datetime import timedelta
from typing import Any

from flask import Response, current_app

ACCESS_COOKIE = "access_token_cookie"
REFRESH_COOKIE = "refresh_token"
ACCESS_MAX_AGE = timedelta(hours=24)
REFRESH_MAX_AGE = timedelta(days=7)


def _attributes() -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": current_app.config["JWT_COOKIE_SECURE"],
        "samesite": current_app.config["JWT_COOKIE_SAMESITE"],
        "path": "/",
    }


def _set_cookie(response: Response, name: str, token: str, max_age: timedelta) -> None:
    response.set_cookie(
        name, token, max_age=int(max_age.total_seconds()), **_attributes()
    )


def set_access_cookies(response: Response, access_token: str) -> None:
    _set_cookie(response, ACCESS_COOKIE, access_token, ACCESS_MAX_AGE)


def set_refresh_cookies(response: Response, refresh_token: str) -> None:
    _set_cookie(response, REFRESH_COOKIE, refresh_token, REFRESH_MAX_AGE)


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, **_attributes())
