from datetime import datetime, timezone

from marshmallow import EXCLUDE, Schema, fields, pre_load, validate

from app.schemas.constants import VALID_CATEGORIES
from app.schemas.fields import Text
from app.schemas.task_schema import TaskSchema

MAX_PARSE_TEXT_LENGTH = 500
MAX_DECOMPOSE_TITLE_LENGTH = 255
MAX_DECOMPOSE_DESCRIPTION_LENGTH = 2000


class ParseTaskSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    text = Text(
        required=True,
        validate=[
            validate.Length(min=1, error="Text is required."),
            validate.Length(
                max=MAX_PARSE_TEXT_LENGTH,
                error=f"Text must be {MAX_PARSE_TEXT_LENGTH} characters or fewer.",
            ),
        ],
        error_messages={
            "required": "Text is required.",
            "null": "Text is required.",
            "invalid": "Text is required.",
        },
    )


class DecomposeSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    title = Text(
        required=True,
        validate=[
            validate.Length(min=1, error="Title is required."),
            validate.Length(
                max=MAX_DECOMPOSE_TITLE_LENGTH,
                error=f"Title must be {MAX_DECOMPOSE_TITLE_LENGTH} characters or fewer.",
            ),
        ],
        error_messages={"required": "Title is required.", "null": "Title is required."},
    )
    description = fields.String(
        allow_none=True,
        validate=validate.Length(
            max=MAX_DECOMPOSE_DESCRIPTION_LENGTH,
            error=f"Description must be {MAX_DECOMPOSE_DESCRIPTION_LENGTH} characters or fewer.",
        ),
        error_messages={"invalid": "Description must be text."},
    )
    category = fields.String(
        allow_none=True,
        validate=validate.OneOf([*VALID_CATEGORIES, ""], error="Invalid category."),
    )
    startAt = fields.String(allow_none=True, validate=validate.Length(max=40))
    endAt = fields.String(allow_none=True, validate=validate.Length(max=40))


class AiTaskSchema(TaskSchema):
    @pre_load
    def repair(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        category = str(data.get("category") or "").strip().lower()
        data["category"] = category if category in VALID_CATEGORIES else "general"
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        data["startAt"] = data.get("startAt") or f"{today} 00:00:00"
        data["endAt"] = data.get("endAt") or f"{today} 23:59:59"
        return data
