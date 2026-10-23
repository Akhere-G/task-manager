from unittest import mock

import pytest

import app.routes.mail_routes as mail_routes

VALID = {
    "fullName": "Ann Visitor",
    "email": "ann@example.com",
    "subject": "Bug Report",
    "message": "Something is broken on the page.",
}


def test_message_is_html_escaped():
    html = mail_routes.send_enquiry_email(
        "<b>Ann</b>", "a@b.co", "Hi", "<script>alert(1)</script>"
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<b>Ann</b>" not in html


def test_valid_enquiry_sends_with_reply_to(client):
    with mock.patch.object(mail_routes, "MailerSendClient") as ms:
        response = client.post("/api/contact", json=VALID)
    assert response.status_code == 201
    sent = ms.return_value.emails.send.call_args[0][0]
    assert sent.reply_to.email == "ann@example.com"
    assert sent.subject == "[Contact] Bug Report"


def test_mailer_failure_returns_502(client):
    with mock.patch.object(mail_routes, "MailerSendClient") as ms:
        ms.return_value.emails.send.side_effect = RuntimeError("provider down")
        response = client.post("/api/contact", json=VALID)
    assert response.status_code == 502
    assert "provider down" not in response.get_data(as_text=True)


@pytest.mark.parametrize("body", [None, [], {}, {**VALID, "email": "nope"}])
def test_invalid_bodies_return_400(client, body):
    assert client.post("/api/contact", json=body).status_code == 400

