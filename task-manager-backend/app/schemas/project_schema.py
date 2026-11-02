from typing import Any

from marshmallow import fields, validate

from app.constants import MAX_PROJECT_NAME_LENGTH

from .base import CamelSchema
from .fields import StrippedString

COLOUR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class ProjectSchema(CamelSchema):
    id = fields.Integer(dump_only=True)
    name = StrippedString(
        required=True,
        validate=validate.Length(
            min=1,
            max=MAX_PROJECT_NAME_LENGTH,
            error=f"Name must be 1 to {MAX_PROJECT_NAME_LENGTH} characters.",
        ),
        error_messages={"required": "Name is required."},
    )
    colour = fields.String(
        validate=validate.Regexp(COLOUR_PATTERN, error="Colour must look like #1a2b3c.")
    )
    parent_id = fields.Integer(allow_none=True, strict=True)
    position = fields.Integer(strict=True, validate=validate.Range(min=0))


class ProjectUpdateSchema(ProjectSchema):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(partial=True, **kwargs)
