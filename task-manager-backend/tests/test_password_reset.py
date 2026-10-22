from unittest import mock

import app.routes.auth_routes as auth_routes
from tests.conftest import DEFAULT_PASSWORD


def request_reset(client, email):
    return client.post("/api/auth/request-password-reset", json={"email": email})


def test_same_response_for_known_and_unknown_email(client, make_user):
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email"):
        known = request_reset(client, "user@example.com")
        unknown = request_reset(client, "ghost@example.com")
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()


def test_mailer_failure_still_returns_generic_200(client, make_user):
    make_user()
    with mock.patch.object(
        auth_routes, "send_password_reset_email", side_effect=RuntimeError("smtp secret")
    ):
        response = request_reset(client, "user@example.com")
    assert response.status_code == 200
    assert "smtp secret" not in response.get_data(as_text=True)


def test_demo_account_gets_no_email(client, make_demo_user):
    make_demo_user()
    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        assert request_reset(client, "demo@taskflow.invalid").status_code == 200
    send.assert_not_called()


def test_reset_link_has_single_slash(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://app.example/")
    with mock.patch.object(auth_routes, "MailerSendClient") as ms:
        auth_routes.send_password_reset_email({"first_name": "A"}, "a@b.co", "tok")
    payload = ms.return_value.emails.send.call_args[0][0]
    assert "https://app.example/reset-password?token=tok" in payload.html
    assert "example//reset" not in payload.html


def test_reset_token_changes_password_once(client, make_user):
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        request_reset(client, "user@example.com")
    token = send.call_args[0][2]

    new_password = "Another-pass7"
    ok = client.post("/api/auth/reset-password", json={"token": token, "password": new_password})
    assert ok.status_code == 200
    again = client.post("/api/auth/reset-password", json={"token": token, "password": new_password})
    assert again.status_code == 400

    login = client.post("/api/auth/login", json={"email": "user@example.com", "password": new_password})
    assert login.status_code == 200
    old = client.post("/api/auth/login", json={"email": "user@example.com", "password": DEFAULT_PASSWORD})
    assert old.status_code == 400


def test_common_password_rejected_on_reset(client, make_user):
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        request_reset(client, "user@example.com")
    token = send.call_args[0][2]
    response = client.post("/api/auth/reset-password", json={"token": token, "password": "Qwerty123"})
    assert response.status_code == 400
