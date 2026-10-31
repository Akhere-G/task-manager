from unittest import mock

from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from app.services import mail_service


def login(
    client: FlaskClient, email: str = "user@example.com", ip: str = "198.51.100.1"
) -> TestResponse:
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrong-pass1"},
        headers={"X-Forwarded-For": ip},
    )


def test_login_is_limited_per_ip(client: FlaskClient) -> None:
    codes = [login(client, email=f"user{n}@example.com").status_code for n in range(11)]
    assert codes == [400] * 10 + [429]

    limited = login(client, email="another@example.com")
    assert limited.is_json
    assert int(limited.headers["Retry-After"]) > 0

    assert login(client, ip="203.0.113.9").status_code == 400


def test_repeated_attempts_on_one_email_are_limited_sooner(client: FlaskClient) -> None:
    codes = [login(client).status_code for _ in range(6)]
    assert codes == [400] * 5 + [429]
    assert login(client, email="someone.else@example.com").status_code == 400


def test_contact_form_is_limited(client: FlaskClient) -> None:
    body = {
        "fullName": "Ann",
        "email": "ann@example.com",
        "subject": "Bug Report",
        "message": "Something is broken here.",
    }
    with mock.patch.object(mail_service, "MailerSendClient"):
        codes = [client.post("/api/contact", json=body).status_code for _ in range(4)]
    assert codes == [201, 201, 201, 429]
