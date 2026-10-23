import pytest
from marshmallow import ValidationError

from app.schemas.auth_schema import (
    LoginSchema,
    PasswordResetRequestSchema,
    RegisterSchema,
    ResetPasswordSchema,
)
from app.utils.http import flatten_errors

REGISTRATION = {
    "firstName": "Ann",
    "lastName": "Lee",
    "email": " ann@example.com ",
    "password": "Sturdy-pass9",
    "confirmPassword": "Sturdy-pass9",
}


def errors_for(schema, data):
    with pytest.raises(ValidationError) as caught:
        schema.load(data)
    return flatten_errors(caught.value.messages)


def test_registration_trims_text_and_ignores_unknown_fields():
    data = RegisterSchema().load({**REGISTRATION, "isDemo": True})
    assert data["email"] == "ann@example.com"
    assert "isDemo" not in data


@pytest.mark.parametrize(
    "change, field",
    [
        ({"firstName": ""}, "firstName"),
        ({"lastName": "x" * 51}, "lastName"),
        ({"email": "not-an-email"}, "email"),
        ({"email": "x" * 100 + "@example.com"}, "email"),
        ({"password": "short1", "confirmPassword": "short1"}, "password"),
        ({"password": "onlyletters", "confirmPassword": "onlyletters"}, "password"),
        ({"password": "password123", "confirmPassword": "password123"}, "password"),
        ({"confirmPassword": "Different9x"}, "confirmPassword"),
    ],
)
def test_invalid_registration_names_the_field(change, field):
    assert field in errors_for(RegisterSchema(), {**REGISTRATION, **change})


def test_login_requires_email_and_password():
    assert set(errors_for(LoginSchema(), {})) == {"email", "password"}


def test_reset_password_applies_the_same_password_rules():
    assert "password" in errors_for(ResetPasswordSchema(), {"token": "t", "password": "weak"})
    assert ResetPasswordSchema().load({"token": "t", "password": "Sturdy-pass9"})["token"] == "t"


def test_reset_request_needs_an_email():
    assert "email" in errors_for(PasswordResetRequestSchema(), {"email": "  "})
