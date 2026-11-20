from marshmallow import fields, validate

from app.constants import MAX_API_TOKEN_NAME_LENGTH
from app.models import TokenScope

from .base import CamelSchema
from .fields import StrippedString, UtcDateTime


class ApiTokenSchema(CamelSchema):
    id = fields.Integer(dump_only=True)
    name = StrippedString(
        required=True,
        validate=validate.Length(
            min=1,
            max=MAX_API_TOKEN_NAME_LENGTH,
            error=f"Name must be 1 to {MAX_API_TOKEN_NAME_LENGTH} characters.",
        ),
        error_messages={"required": "Name is required."},
    )
    scope = fields.Enum(
        TokenScope,
        by_value=True,
        required=True,
        error_messages={"required": "Scope is required."},
    )
    prefix = fields.String(dump_only=True)
    created_at = UtcDateTime(dump_only=True)
    last_used_at = UtcDateTime(dump_only=True)
