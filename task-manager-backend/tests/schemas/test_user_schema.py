from typing import Any

import pytest

from app.schemas.user_schema import LoginSchema, PasswordResetSchema, RegisterSchema
from tests.builders import DEFAULT_PASSWORD, register_body
from tests.schemas.helpers import load_errors

REGISTER = register_body()


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
            {"password": "Password1", "confirmPassword": "Password1"},
            "password",
            "That password is too common. Choose a different one.",
        ),
        (
            {"confirmPassword": "Different-pass9"},
            "confirmPassword",
            "Passwords do not match.",
        ),
        ({"confirmPassword": ""}, "confirmPassword", "Confirm password is required."),
    ],
)
def test_register_explains_each_rule(
    override: dict[str, Any], field: str, message: str
) -> None:
    assert load_errors(RegisterSchema(), {**REGISTER, **override})[field] == message


def test_register_reports_every_missing_field_at_once() -> None:
    assert set(load_errors(RegisterSchema(), {})) == {
        "firstName",
        "lastName",
        "email",
        "password",
        "confirmPassword",
    }


def test_register_trims_names_and_email() -> None:
    body = {**REGISTER, "firstName": "  Ann ", "email": " ann@example.com "}

    data = RegisterSchema().load(body)

    assert (data["first_name"], data["email"]) == ("Ann", "ann@example.com")


def test_login_needs_both_fields() -> None:
    assert set(load_errors(LoginSchema(), {"email": " "})) == {"email", "password"}


def test_reset_needs_a_token_and_a_strong_new_password() -> None:
    assert load_errors(PasswordResetSchema(), {"password": DEFAULT_PASSWORD}) == {
        "token": "Invalid reset link."
    }
    assert load_errors(PasswordResetSchema(), {"token": "abc", "password": "abc"}) == {
        "password": "Password must be at least 8 characters."
    }
