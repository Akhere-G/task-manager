from collections.abc import Callable
from typing import Any

import pytest
from flask.testing import FlaskClient

from tests.conftest import DEFAULT_PASSWORD

REGISTER = {
    "firstName": "New",
    "lastName": "Person",
    "email": "new@example.com",
    "password": DEFAULT_PASSWORD,
    "confirmPassword": DEFAULT_PASSWORD,
}


def errors_for(client: FlaskClient, url: str, body: dict[str, Any]) -> Any:
    response = client.post(url, json=body)
    assert response.status_code == 400, response.get_json()
    return response.get_json()["errors"]


@pytest.mark.parametrize(
    "override, field, message",
    [
        ({"firstName": " "}, "firstName", "First name is required."),
        (
            {"lastName": "x" * 51},
            "lastName",
            "Last name must be 50 characters or less.",
        ),
        ({"email": "nope"}, "email", "Please enter a valid email address."),
        (
            {"email": "a" * 100 + "@b.co"},
            "email",
            "Email must be 100 characters or less.",
        ),
        (
            {"password": "short1", "confirmPassword": "short1"},
            "password",
            "Password must be at least 8 characters.",
        ),
        (
            {"password": "onlyletters", "confirmPassword": "onlyletters"},
            "password",
            "Password must contain both letters and numbers.",
        ),
        (
            {"confirmPassword": "Different-pass9"},
            "confirmPassword",
            "Passwords do not match.",
        ),
        ({"confirmPassword": ""}, "confirmPassword", "Confirm password is required."),
    ],
)
def test_register_messages(
    client: FlaskClient, override: dict[str, Any], field: str, message: str
) -> None:
    assert (
        errors_for(client, "/api/auth/register", {**REGISTER, **override})[field]
        == message
    )


def test_register_reports_every_bad_field_at_once(client: FlaskClient) -> None:
    assert set(errors_for(client, "/api/auth/register", {})) == {
        "firstName",
        "lastName",
        "email",
        "password",
        "confirmPassword",
    }


def test_register_trims_names_and_email(client: FlaskClient) -> None:
    body = {**REGISTER, "firstName": "  Ann ", "email": " ann@example.com "}
    user = client.post("/api/auth/register", json=body).get_json()["user"]
    assert (user["firstName"], user["email"]) == ("Ann", "ann@example.com")


def test_login_requires_both_fields(client: FlaskClient) -> None:
    assert set(errors_for(client, "/api/auth/login", {"email": " "})) == {
        "email",
        "password",
    }


def test_wrong_login_is_a_general_error(
    client: FlaskClient, make_user: Callable[..., int]
) -> None:
    make_user()
    body = {"email": "user@example.com", "password": "nope-nope1"}
    assert errors_for(client, "/api/auth/login", body) == {
        "general": "Invalid credentials."
    }


def test_reset_password_rules_apply_to_the_new_password(client: FlaskClient) -> None:
    errors = errors_for(
        client, "/api/auth/reset-password", {"token": "abc", "password": "Password1"}
    )
    assert errors == {
        "password": "That password is too common. Choose a different one."
    }
    assert "token" in errors_for(
        client, "/api/auth/reset-password", {"password": DEFAULT_PASSWORD}
    )


def test_contact_messages(client: FlaskClient) -> None:
    body = {
        "fullName": "Ann",
        "email": "ann@example.com",
        "subject": "Hi",
        "message": "short",
    }
    errors = errors_for(client, "/api/contact", body)
    assert errors == {
        "message": "Please provide a bit more detail (minimum 10 characters)."
    }
    assert (
        errors_for(client, "/api/contact", {})["fullName"] == "Full name is required."
    )
