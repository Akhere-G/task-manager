import re

from marshmallow import EXCLUDE, Schema, ValidationError, validate, validates_schema

from app.schemas.fields import Text
from app.utils.common_passwords import is_common_password

EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


def required_text(label, *validators):
    message = f"{label} is required."
    return Text(
        required=True,
        validate=[validate.Length(min=1, error=message), *validators],
        error_messages={"required": message, "null": message},
    )


def check_password_strength(password):
    if not (re.search(r"[A-Za-z]", password) and re.search(r"[0-9]", password)):
        raise ValidationError("Password must contain both letters and numbers.")
    if is_common_password(password):
        raise ValidationError("That password is too common. Choose a different one.")


def new_password_field():
    return required_text(
        "Password",
        validate.Length(min=8, error="Password must be at least 8 characters."),
        validate.Length(max=50, error="Password must be 50 characters or less."),
        check_password_strength,
    )


class LoginSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    email = required_text("Email")
    password = required_text("Password")


class RegisterSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    firstName = required_text(
        "First name", validate.Length(max=50, error="First name must be 50 characters or less.")
    )
    lastName = required_text(
        "Last name", validate.Length(max=50, error="Last name must be 50 characters or less.")
    )
    email = required_text(
        "Email",
        validate.Length(max=100, error="Email must be 100 characters or less."),
        validate.Regexp(EMAIL_PATTERN, error="Please enter a valid email address."),
    )
    password = new_password_field()
    confirmPassword = required_text("Confirm password")

    @validates_schema
    def passwords_match(self, data, **kwargs):
        if data["confirmPassword"] != data["password"]:
            raise ValidationError("Passwords do not match.", field_name="confirmPassword")


class PasswordResetRequestSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    email = Text(
        required=True,
        validate=validate.Length(min=1, error="Email is required"),
        error_messages={"required": "Email is required", "null": "Email is required"},
    )


class ResetPasswordSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    token = required_text("Token")
    password = new_password_field()
