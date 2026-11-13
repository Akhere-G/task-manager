from typing import Any

from marshmallow import fields, validate

from app.constants import MAX_COLUMN_NAME_LENGTH, MAX_COLUMN_STATUS_LENGTH
from app.models import OnDrop

from .base import CamelSchema
from .fields import StrippedString
from .project_schema import COLOUR_PATTERN


class ColumnSchema(CamelSchema):
    id = fields.Integer(dump_only=True)
    project_id = fields.Integer(dump_only=True)
    name = StrippedString(
        required=True,
        validate=validate.Length(
            min=1,
            max=MAX_COLUMN_NAME_LENGTH,
            error=f"Name must be 1 to {MAX_COLUMN_NAME_LENGTH} characters.",
        ),
        error_messages={"required": "Name is required."},
    )
    status = StrippedString(
        validate=validate.Length(
            min=1,
            max=MAX_COLUMN_STATUS_LENGTH,
            error=f"Status must be 1 to {MAX_COLUMN_STATUS_LENGTH} characters.",
        ),
    )
    colour = fields.String(
        validate=validate.Regexp(COLOUR_PATTERN, error="Colour must look like #1a2b3c.")
    )
    on_drop = fields.Enum(OnDrop, by_value=True)
    position = fields.Integer(dump_only=True)


class ColumnUpdateSchema(ColumnSchema):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(partial=True, **kwargs)


class ColumnOrderSchema(CamelSchema):
    column_ids = fields.List(
        fields.Integer(strict=True),
        required=True,
        validate=validate.Length(min=1),
    )


class ColumnDeleteSchema(CamelSchema):
    move_to_id = fields.Integer(
        required=True,
        strict=True,
        error_messages={"required": "Choose a column for its tasks."},
    )


class BoardMoveSchema(CamelSchema):
    column_id = fields.Integer(required=True, strict=True)
    after_id = fields.Integer(strict=True, allow_none=True)
    before_id = fields.Integer(strict=True, allow_none=True)
