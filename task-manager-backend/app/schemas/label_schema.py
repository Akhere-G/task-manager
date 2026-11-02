from typing import Any

from marshmallow import fields, validate

from app.constants import MAX_LABEL_NAME_LENGTH

from .base import CamelSchema
from .fields import StrippedString
from .project_schema import COLOUR_PATTERN


class LabelSchema(CamelSchema):
    id = fields.Integer(dump_only=True)
    name = StrippedString(
        required=True,
        validate=validate.Length(
            min=1,
            max=MAX_LABEL_NAME_LENGTH,
            error=f"Name must be 1 to {MAX_LABEL_NAME_LENGTH} characters.",
        ),
        error_messages={"required": "Name is required."},
    )
    colour = fields.String(
        validate=validate.Regexp(COLOUR_PATTERN, error="Colour must look like #1a2b3c.")
    )


class LabelUpdateSchema(LabelSchema):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(partial=True, **kwargs)
