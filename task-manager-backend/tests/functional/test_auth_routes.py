from unittest import mock

import app.routes.auth_routes as auth_routes
from tests.conftest import DEFAULT_PASSWORD


def register(client, email="new@example.com"):
    return client.post(
        "/api/auth/register",
        json={
            "firstName": "New",
            "lastName": "Person",
            "email": email,
            "password": DEFAULT_PASSWORD,
            "confirmPassword": DEFAULT_PASSWORD,
        },
    )


def request_reset(client, email):
    return client.post("/api/auth/request-password-reset", json={"email": email})


def test_register_signs_the_user_in(client):
    response = register(client)
    assert response.status_code == 201
    assert client.get("/api/auth/me").get_json()["user"]["email"] == "new@example.com"


def test_register_reports_validation_errors_by_field(client):
    response = client.post("/api/auth/register", json={"email": "bad"})
    assert response.status_code == 400
    assert {"firstName", "lastName", "email", "password"} <= set(response.get_json()["errors"])


def test_registering_an_existing_email_is_rejected(client):
    register(client)
    assert register(client).status_code == 400


def test_login_with_the_wrong_password_is_rejected(client, make_user):
    make_user()
    response = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": "nope-nope1"}
    )
    assert response.status_code == 400
    assert response.get_json()["errors"]["general"] == "Invalid credentials."


def test_login_is_limited_per_ip(client):
    def attempt(ip="198.51.100.1"):
        return client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "wrong-pass1"},
            headers={"X-Forwarded-For": ip},
        )

    codes = [attempt().status_code for _ in range(6)]
    assert codes == [400] * 5 + [429]
    assert int(attempt().headers["Retry-After"]) > 0
    assert attempt("203.0.113.9").status_code == 400


def test_demo_account_signs_in_without_a_password_but_not_with_one(client, make_demo_user):
    make_demo_user()
    assert client.post("/api/auth/demo").get_json()["user"]["isDemo"] is True

    other = client.application.test_client()
    response = other.post(
        "/api/auth/login",
        json={"email": "demo@taskflow.invalid", "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 400


def test_refresh_issues_a_new_token_and_logout_revokes_it(client, make_user, login):
    make_user()
    session = login()
    first = session.get_cookie("refresh_token").value

    assert session.post("/api/auth/refresh").status_code == 200
    second = session.get_cookie("refresh_token").value
    assert second != first

    assert session.post("/api/auth/logout").status_code == 200
    client.set_cookie("refresh_token", second)
    assert client.post("/api/auth/refresh").status_code == 401


def test_state_changing_requests_need_the_ajax_header(make_user, login):
    make_user()
    session = login()
    del session.environ_base["HTTP_X_REQUESTED_WITH"]

    assert session.post("/api/auth/logout").status_code == 403
    assert session.get("/api/auth/me").status_code == 200


def test_requests_without_a_session_are_rejected(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/tasks").status_code == 401


def test_password_reset_flow_changes_the_password_and_signs_out_other_devices(
    client, make_user, login
):
    make_user()
    other_device = login()
    other_cookie = other_device.get_cookie("refresh_token").value

    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        known = request_reset(client, "user@example.com")
        unknown = request_reset(client, "ghost@example.com")
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()
    token = send.call_args[0][2]

    reset = {"token": token, "password": "Another-pass7"}
    assert client.post("/api/auth/reset-password", json=reset).status_code == 200
    assert client.post("/api/auth/reset-password", json=reset).status_code == 400

    signed_in = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": "Another-pass7"}
    )
    assert signed_in.status_code == 200

    client.set_cookie("refresh_token", other_cookie)
    assert client.post("/api/auth/refresh").status_code == 401


def test_a_failing_mailer_does_not_reveal_the_account(client, make_user):
    make_user()
    with mock.patch.object(
        auth_routes, "send_password_reset_email", side_effect=RuntimeError("mailer down")
    ):
        response = request_reset(client, "user@example.com")
    assert response.status_code == 200
