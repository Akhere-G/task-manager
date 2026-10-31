from unittest import mock

from app.services import mail_service


def login(client, email="user@example.com", ip="198.51.100.1"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrong-pass1"},
        headers={"X-Forwarded-For": ip},
    )


def test_login_is_limited_per_ip(client):
    codes = [login(client, email=f"user{n}@example.com").status_code for n in range(11)]
    assert codes == [400] * 10 + [429]

    limited = login(client, email="another@example.com")
    assert limited.is_json
    assert int(limited.headers["Retry-After"]) > 0

    assert login(client, ip="203.0.113.9").status_code == 400


def test_repeated_attempts_on_one_email_are_limited_sooner(client):
    codes = [login(client).status_code for _ in range(6)]
    assert codes == [400] * 5 + [429]
    assert login(client, email="someone.else@example.com").status_code == 400


def test_contact_form_is_limited(client):
    body = {
        "fullName": "Ann",
        "email": "ann@example.com",
        "subject": "Bug Report",
        "message": "Something is broken here.",
    }
    with mock.patch.object(mail_service, "MailerSendClient"):
        codes = [client.post("/api/contact", json=body).status_code for _ in range(4)]
    assert codes == [201, 201, 201, 429]
