from datetime import datetime, timezone

from marshmallow import EXCLUDE, Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.schemas.constants import REPEAT_OPTIONS, VALID_CATEGORIES
from app.schemas.fields import IsoDate, IsoDateTime, Text, parse_naive_utc

STRICT_BOOLEAN = {"truthy": {True}, "falsy": {False}}


class TaskSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    title = Text(
        required=True,
        validate=[
            validate.Length(min=1, error="Title is mandatory."),
            validate.Length(max=255, error="Title must be under 255 characters."),
        ],
        error_messages={"required": "Title is mandatory."},
    )
    description = Text(allow_none=True)
    category = Text(
        required=True,
        validate=[
            validate.Length(min=1, error="Category is mandatory."),
            validate.Length(max=50, error="Category name is too long."),
            validate.OneOf(
                VALID_CATEGORIES,
                error="Invalid category. Must be one of: " + ", ".join(VALID_CATEGORIES) + ".",
            ),
        ],
        error_messages={"required": "Category is mandatory."},
    )
    startAt = IsoDateTime(
        required=True,
        error_messages={"required": "Start At is mandatory.", "null": "Start At is mandatory."},
    )
    endAt = IsoDateTime(
        required=True,
        error_messages={"required": "End At is mandatory.", "null": "End At is mandatory."},
    )
    isCompleted = fields.Boolean(
        **STRICT_BOOLEAN,
        error_messages={"invalid": "Completion status must be a boolean (true/false)."},
    )
    completedAt = IsoDateTime(
        allow_none=True,
        error_messages={"invalid": "Invalid timestamp. Use YYYY-MM-DD HH:MM:SS or ISO format."},
    )
    isRepeating = fields.Boolean(
        allow_none=True,
        **STRICT_BOOLEAN,
        error_messages={"invalid": "isRepeating must be a boolean (true/false)."},
    )
    repeatBy = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            REPEAT_OPTIONS, error="Repeat must be daily, weekly, monthly or yearly."
        ),
    )
    repeatUntil = IsoDate(allow_none=True)
    createdAt = fields.Raw(allow_none=True)
    expectedStartAt = IsoDateTime(allow_none=True)

    @pre_load
    def normalise(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        for key in ("repeatBy", "repeatUntil"):
            if data.get(key) == "":
                data[key] = None
        return data

    @validates_schema(skip_on_field_errors=False)
    def check_relationships(self, data, **kwargs):
        errors = {}
        start, end = data.get("startAt"), data.get("endAt")
        if start and end and parse_naive_utc(end) <= parse_naive_utc(start):
            errors["endAt"] = "End time must be after the start time."

        if "isCompleted" in data:
            completed_at = data.get("completedAt")
            if data["isCompleted"] and not completed_at:
                errors["isCompleted"] = "Must send completed at date if completing task."
            elif not data["isCompleted"] and completed_at:
                errors["isCompleted"] = (
                    "Must send null for completed at date if uncompleting task."
                )

        if data.get("isRepeating") and not data.get("repeatBy"):
            errors["repeatBy"] = "Repeat By is required for repeating tasks."

        if errors:
            raise ValidationError(errors)


class TaskCreateSchema(TaskSchema):
    @pre_load
    def mark_repeating(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if data.get("repeatBy"):
            data["isRepeating"] = True
        return data


class BulkTaskSchema(TaskCreateSchema):
    @pre_load
    def default_completion(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if data.get("isCompleted") and not data.get("completedAt"):
            data["completedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        elif not data.get("isCompleted"):
            data["completedAt"] = None
        data["isCompleted"] = data.get("isCompleted", False)
        return data
