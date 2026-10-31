import re
from typing import Any

from marshmallow import ValidationError, fields, validates_schema

from app.utils.common_passwords import is_common_password

from .base import CamelSchema
from .fields import StrippedString, email, text


def validate_new_password(value: str) -> None:
    if not (re.search(r"[A-Za-z]", value) and re.search(r"[0-9]", value)):
        raise ValidationError("Password must contain both letters and numbers.")
    if is_common_password(value):
        raise ValidationError("That password is too common. Choose a different one.")


def new_password() -> StrippedString:
    return text(
        "Password",
        50,
        min_length=8,
        min_message="Password must be at least 8 characters.",
        extra_validators=[validate_new_password],
    )


class UserSchema(CamelSchema):
    id = fields.Integer(dump_only=True)
    first_name = fields.String(dump_only=True)
    last_name = fields.String(dump_only=True)
    email = fields.String(dump_only=True)
    is_demo = fields.Boolean(dump_only=True)


class LoginSchema(CamelSchema):
    email = text("Email", 254)
    password = text("Password", 1000)


class RegisterSchema(CamelSchema):
    first_name = text("First name", 50)
    last_name = text("Last name", 50)
    email = email(100)
    password = new_password()
    confirm_password = text(
        "Confirm password", 1000, required="Confirm password is required."
    )

    @validates_schema
    def passwords_match(self, data: dict[str, Any], **kwargs: Any) -> None:
        if data["confirm_password"] != data["password"]:
            raise ValidationError(
                "Passwords do not match.", field_name="confirm_password"
            )


class EmailSchema(CamelSchema):
    email = text("Email", 254)


class PasswordResetSchema(CamelSchema):
    token = text("Token", 255, required="Invalid reset link.")
    password = new_password()
