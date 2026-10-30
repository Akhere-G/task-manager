from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field
from marshmallow import pre_load, validates_schema, ValidationError
from ..models import Task
import re


class TaskSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Task

    @pre_load
    def camel_to_snake(self, data, many, partial, **kwargs):
        return {self._to_snake(k): v for k, v in data.items()}

    def _to_snake(self, s):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()

    id = auto_field(dump_only=True)
    user_id = auto_field(dump_only=True)

    title = auto_field(
        error_messages={
            "required": "Title is required.",
        },
    )

    description = auto_field()

    category = auto_field(
        error_messages={
            "required": "Category is required.",
        },
    )

    is_completed = auto_field()
    completed_at = auto_field()

    start_at = auto_field(
        error_messages={
            "required": "Start time is required.",
        }
    )

    end_at = auto_field(
        error_messages={
            "required": "End time is required.",
        }
    )

    is_repeating = auto_field()
    repeat_by = auto_field()
    repeat_until = auto_field()
    repeat_interval = auto_field()
    repeat_days = auto_field()
    repeat_timezone = auto_field()

    @validates_schema
    def validate_times(self, data, **kwargs):
        start = data.get("start_at")
        end = data.get("end_at")

        if start and end and end <= start:
            raise ValidationError(
                "End time must be after the start time.", field_name="end_at"
            )
