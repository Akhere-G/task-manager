from collections.abc import Callable
from unittest import mock

from flask.testing import FlaskClient
from werkzeug.test import TestResponse

import app.routes.auth_routes as auth_routes
from tests.conftest import DEFAULT_PASSWORD


def request_reset(client: FlaskClient, email: str) -> TestResponse:
    return client.post("/api/auth/request-password-reset", json={"email": email})


def test_request_does_not_reveal_whether_the_account_exists(
    client: FlaskClient, make_user: Callable[..., int]
) -> None:
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email"):
        known = request_reset(client, "user@example.com")
        unknown = request_reset(client, "ghost@example.com")
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()

    with mock.patch.object(
        auth_routes,
        "send_password_reset_email",
        side_effect=RuntimeError("mailer down"),
    ):
        failed = request_reset(client, "user@example.com")
    assert failed.status_code == 200
    assert failed.get_json() == known.get_json()


def test_reset_link_changes_the_password_once(
    client: FlaskClient, make_user: Callable[..., int]
) -> None:
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        request_reset(client, "user@example.com")
    token = send.call_args[0][2]

    new_password = "Another-pass7"
    reset = {"token": token, "password": new_password}
    assert client.post("/api/auth/reset-password", json=reset).status_code == 200
    assert client.post("/api/auth/reset-password", json=reset).status_code == 400

    login = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": new_password}
    )
    assert login.status_code == 200
    old = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": DEFAULT_PASSWORD},
    )
    assert old.status_code == 400


def test_password_reset_signs_out_other_devices(
    client: FlaskClient,
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
) -> None:
    make_user()
    other_device = login()
    cookie = other_device.get_cookie("refresh_token").value

    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        request_reset(client, "user@example.com")
    token = send.call_args[0][2]
    client.post(
        "/api/auth/reset-password", json={"token": token, "password": "Another-pass7"}
    )

    client.set_cookie("refresh_token", cookie)
    assert client.post("/api/auth/refresh").status_code == 401
