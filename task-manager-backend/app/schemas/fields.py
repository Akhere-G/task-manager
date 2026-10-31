from collections.abc import Callable, Mapping
from datetime import datetime
from typing import Any

from dateutil import parser
from marshmallow import ValidationError, fields, validate

from app.utils.dates import as_naive_utc, to_iso_z


class StrippedString(fields.String):
    def _deserialize(
        self,
        value: Any,
        attr: str | None,
        data: Mapping[str, Any] | None,
        **kwargs: Any,
    ) -> str:
        return super()._deserialize(value, attr, data, **kwargs).strip()


class IsoDateTime(fields.DateTime):
    default_error_messages = {"invalid": "Invalid date. Use ISO format."}

    def _deserialize(
        self,
        value: Any,
        attr: str | None,
        data: Mapping[str, Any] | None,
        **kwargs: Any,
    ) -> datetime:
        if not isinstance(value, str):
            raise self.make_error("invalid")
        try:
            return parser.isoparse(value)
        except ValueError:
            raise self.make_error("invalid") from None


class UtcDateTime(IsoDateTime):
    def _deserialize(
        self,
        value: Any,
        attr: str | None,
        data: Mapping[str, Any] | None,
        **kwargs: Any,
    ) -> datetime:
        return as_naive_utc(super()._deserialize(value, attr, data, **kwargs))

    def _serialize(
        self, value: datetime | None, attr: str | None, obj: Any, **kwargs: Any
    ) -> str | None:
        return None if value is None else to_iso_z(value)


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


def not_blank(message: str) -> Callable[[str], None]:
    def validator(value: str) -> None:
        if not value.strip():
            raise ValidationError(message)

    return validator


def no_line_breaks(message: str) -> Callable[[str], None]:
    def validator(value: str) -> None:
        if "\r" in value or "\n" in value:
            raise ValidationError(message)

    return validator


def text(
    name: str,
    max_length: int,
    *,
    min_length: int = 1,
    required: str | None = None,
    min_message: str | None = None,
    **kwargs: Any,
) -> StrippedString:
    required = required or f"{name} is required."
    validators = [not_blank(required)]
    if min_length > 1:
        validators.append(validate.Length(min=min_length, error=min_message))
    validators.append(
        validate.Length(
            max=max_length, error=f"{name} must be {max_length} characters or less."
        )
    )
    return StrippedString(
        required=True,
        validate=[*validators, *kwargs.pop("extra_validators", [])],
        error_messages={"required": required},
        **kwargs,
    )


def email(max_length: int) -> StrippedString:
    return text(
        "Email",
        max_length,
        extra_validators=[
            validate.Regexp(EMAIL_PATTERN, error="Please enter a valid email address.")
        ],
    )
