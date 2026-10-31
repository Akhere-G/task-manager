from datetime import timedelta

from flask import current_app

ACCESS_COOKIE = "access_token_cookie"
REFRESH_COOKIE = "refresh_token"
ACCESS_MAX_AGE = timedelta(hours=24)
REFRESH_MAX_AGE = timedelta(days=7)


def _attributes():
    return {
        "httponly": True,
        "secure": current_app.config["JWT_COOKIE_SECURE"],
        "samesite": current_app.config["JWT_COOKIE_SAMESITE"],
        "path": "/",
    }


def _set_cookie(response, name, token, max_age):
    response.set_cookie(
        name, token, max_age=int(max_age.total_seconds()), **_attributes()
    )


def set_access_cookies(response, access_token):
    _set_cookie(response, ACCESS_COOKIE, access_token, ACCESS_MAX_AGE)


def set_refresh_cookies(response, refresh_token):
    _set_cookie(response, REFRESH_COOKIE, refresh_token, REFRESH_MAX_AGE)


def clear_auth_cookies(response):
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, **_attributes())
