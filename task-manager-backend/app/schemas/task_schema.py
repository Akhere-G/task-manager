from marshmallow import ValidationError, validates_schema
from marshmallow_sqlalchemy import auto_field

from ..models import Task
from .base import CamelAutoSchema


class TaskSchema(CamelAutoSchema):
    class Meta(CamelAutoSchema.Meta):
        model = Task

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
