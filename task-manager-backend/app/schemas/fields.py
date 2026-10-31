from dateutil import parser
from marshmallow import ValidationError, fields, validate

from app.utils.dates import as_naive_utc, to_iso_z


class StrippedString(fields.String):
    def _deserialize(self, value, attr, data, **kwargs):
        return super()._deserialize(value, attr, data, **kwargs).strip()


class IsoDateTime(fields.DateTime):
    """Accepts anything `dateutil.parser.isoparse` does, e.g. `2026-03-02 10:00`."""

    default_error_messages = {"invalid": "Invalid date. Use ISO format."}

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, str):
            raise self.make_error("invalid")
        try:
            return parser.isoparse(value)
        except ValueError:
            raise self.make_error("invalid") from None


class UtcDateTime(IsoDateTime):
    """Naive UTC in the database, ISO 8601 with a trailing Z on the way out."""

    def _deserialize(self, value, attr, data, **kwargs):
        return as_naive_utc(super()._deserialize(value, attr, data, **kwargs))

    def _serialize(self, value, attr, obj, **kwargs):
        return None if value is None else to_iso_z(value)


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


def not_blank(message):
    def validator(value):
        if not value.strip():
            raise ValidationError(message)

    return validator


def no_line_breaks(message):
    def validator(value):
        if "\r" in value or "\n" in value:
            raise ValidationError(message)

    return validator


def text(name, max_length, *, min_length=1, required=None, min_message=None, **kwargs):
    """A required, stripped string with the messages used across the API.

    `required` is shown when the field is missing or blank; `min_message` when it is
    shorter than `min_length`.
    """
    required = required or f"{name} is required."
    validators = [not_blank(required)]
    if min_length > 1:
        validators.append(validate.Length(min=min_length, error=min_message))
    validators.append(
        validate.Length(max=max_length, error=f"{name} must be {max_length} characters or less.")
    )
    return StrippedString(
        required=True,
        validate=[*validators, *kwargs.pop("extra_validators", [])],
        error_messages={"required": required},
        **kwargs,
    )


def email(max_length):
    return text(
        "Email",
        max_length,
        extra_validators=[
            validate.Regexp(EMAIL_PATTERN, error="Please enter a valid email address.")
        ],
    )
