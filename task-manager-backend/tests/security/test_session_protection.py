from collections.abc import Callable

from flask import Flask
from flask.testing import FlaskClient


def test_session_cookies_persist_and_are_cleared_on_logout(
    make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    make_user()
    session = login()

    for name in ("access_token_cookie", "refresh_token"):
        cookie = session.get_cookie(name)
        assert cookie.http_only
        assert cookie.max_age and cookie.max_age > 0
        assert cookie.same_site == "Lax"

    session.post("/api/auth/logout")
    assert session.get_cookie("access_token_cookie") is None
    assert session.get_cookie("refresh_token") is None


def test_state_changing_requests_need_the_ajax_header(
    app: Flask, make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    make_user()
    session = login()
    del session.environ_base["HTTP_X_REQUESTED_WITH"]

    assert session.post("/api/auth/logout").status_code == 403
    assert session.post("/api/tasks/1/reschedule", json={}).status_code == 403
    assert session.get("/api/auth/me").status_code == 200

    session.environ_base["HTTP_X_REQUESTED_WITH"] = "XMLHttpRequest"
    assert session.post("/api/auth/logout").status_code == 200
