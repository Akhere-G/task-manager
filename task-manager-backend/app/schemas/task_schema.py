from typing import Any

from marshmallow import (
    EXCLUDE,
    Schema,
    ValidationError,
    fields,
    post_load,
    pre_load,
    validate,
    validates_schema,
)
from marshmallow_sqlalchemy import auto_field

from app.constants import (
    CATEGORIES,
    MAX_PAGE_SIZE,
    MAX_PROJECTION_DAYS,
    REPEAT_FREQUENCIES,
    REPEAT_INTERVAL_LIMITS,
)
from app.models import Task
from app.services.task_query import TaskQuery
from app.utils.dates import is_valid_zone, utc_now
from app.utils.recurrence import is_valid_month_day

from .base import CamelAutoSchema, CamelSchema
from .fields import IsoDateTime, StrippedString, UtcDateTime

BLANK_TO_NONE = ("description", "repeatBy", "repeatUntil", "repeatTimezone")
STRICT_BOOL = {"truthy": {True}, "falsy": {False}}


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_zone(zone_name: str | None) -> None:
    if not is_valid_zone(zone_name):
        raise ValidationError("Repeat time zone is not a valid time zone.")


class TaskSchema(CamelAutoSchema):
    class Meta(CamelAutoSchema.Meta):
        model = Task
        exclude = ("reminded_for_start_at",)

    id = fields.Raw(dump_only=True)
    user_id = auto_field(dump_only=True)
    series_id = auto_field(dump_only=True)
    is_ghost = fields.Boolean(dump_only=True)

    title = StrippedString(
        required=True,
        validate=validate.Length(
            min=1, max=255, error="Title must be 1 to 255 characters."
        ),
        error_messages={"required": "Title is required."},
    )
    description = StrippedString(allow_none=True)
    category = StrippedString(
        required=True,
        validate=validate.OneOf(
            CATEGORIES, error="Invalid category. Must be one of: {choices}."
        ),
        error_messages={"required": "Category is required."},
    )
    start_at = UtcDateTime(
        required=True, error_messages={"required": "Start time is required."}
    )
    end_at = UtcDateTime(
        required=True, error_messages={"required": "End time is required."}
    )
    created_at = UtcDateTime()
    is_completed = fields.Boolean(**STRICT_BOOL)  # type: ignore
    completed_at = UtcDateTime(allow_none=True)
    is_repeating = fields.Boolean(**STRICT_BOOL)  # type: ignore
    repeat_by = fields.String(
        allow_none=True, validate=validate.OneOf(REPEAT_FREQUENCIES)
    )
    repeat_until = auto_field()
    repeat_interval = fields.Integer(strict=True, allow_none=True)
    repeat_days = fields.List(fields.Raw(), allow_none=True)
    repeat_timezone = fields.String(
        allow_none=True,
        validate=_validate_zone,
    )

    @pre_load
    def blank_to_none(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        return {
            k: None if v == "" and k in BLANK_TO_NONE else v for k, v in data.items()
        }

    @validates_schema
    def validate_times(self, data: dict[str, Any], **kwargs: Any) -> None:
        start, end = data.get("start_at"), data.get("end_at")
        if start and end and end <= start:
            raise ValidationError(
                "End time must be after the start time.", field_name="end_at"
            )

    @validates_schema
    def validate_recurrence(self, data: dict[str, Any], **kwargs: Any) -> None:
        repeat_by = data.get("repeat_by")
        if data.get("is_repeating") and not repeat_by:
            raise ValidationError(
                "Repeat By is required for repeating tasks.", field_name="repeat_by"
            )

        interval = data.get("repeat_interval")
        if interval is not None:
            limit = REPEAT_INTERVAL_LIMITS.get(
                repeat_by,  # type: ignore
                max(REPEAT_INTERVAL_LIMITS.values()),  # type: ignore
            )
            if not 1 <= interval <= limit:
                raise ValidationError(
                    f"Repeat interval must be between 1 and {limit}.",
                    field_name="repeat_interval",
                )

        days = data.get("repeat_days")
        if days is not None and (message := self._repeat_days_error(repeat_by, days)):
            raise ValidationError(message, field_name="repeat_days")

    @staticmethod
    def _repeat_days_error(repeat_by: str | None, days: list[Any]) -> str | None:
        if repeat_by == "daily":
            return "Daily tasks do not use repeat days."
        if not days and repeat_by:
            return "Choose at least one day."
        if len(set(map(str, days))) != len(days):
            return "Repeat days must not contain duplicates."
        if repeat_by == "weekly" and not all(_is_int(d) and 0 <= d <= 6 for d in days):
            return "Weekly repeat days must be weekdays (0 to 6)."
        if repeat_by == "monthly" and not all(
            _is_int(d) and 1 <= d <= 31 for d in days
        ):
            return "Monthly repeat days must be between 1 and 31."
        if repeat_by == "yearly" and not all(is_valid_month_day(d) for d in days):
            return "Yearly repeat days must be dates formatted MM-DD."
        return None

    @post_load
    def normalise_state(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        if data.get("repeat_by"):
            data["is_repeating"] = True
        if data.get("description") == "":
            data["description"] = None
        if not self.partial:
            data.setdefault("is_completed", False)
        if "is_completed" in data:
            if not data["is_completed"]:
                data["completed_at"] = None
            elif not self.partial:
                data["completed_at"] = data.get("completed_at") or utc_now()
        return data


class TaskUpdateSchema(TaskSchema):
    class Meta(TaskSchema.Meta):
        dump_only = ("created_at",)

    expected_start_at = UtcDateTime(load_only=True)
    skip_occurrence = fields.Boolean(load_only=True)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(partial=True, **kwargs)


class TaskRescheduleSchema(CamelSchema):
    previous_start_at = UtcDateTime(required=True)
    previous_end_at = UtcDateTime(required=True)
    start_at = UtcDateTime(required=True)
    end_at = UtcDateTime(required=True)
    is_ghost = fields.Boolean(required=True, **STRICT_BOOL)  # type: ignore

    @validates_schema
    def validate_times(self, data: dict[str, Any], **kwargs: Any) -> None:
        if data["previous_end_at"] <= data["previous_start_at"]:
            raise ValidationError(
                "End time must be after the start time.", field_name="previous_end_at"
            )
        if data["end_at"] <= data["start_at"]:
            raise ValidationError(
                "End time must be after the start time.", field_name="end_at"
            )


class TaskListQuerySchema(Schema):
    class Meta:
        unknown = EXCLUDE

    category = fields.String()
    search = fields.String(data_key="q")
    duration = fields.String()
    is_completed = fields.String()
    sort_by = fields.String()
    order = fields.String()
    start_date = IsoDateTime()
    end_date = IsoDateTime()
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    limit = fields.Integer(validate=validate.Range(min=1, max=MAX_PAGE_SIZE))
    project_repeating = fields.Boolean(load_default=False)

    @pre_load
    def drop_blanks(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        return {k: v for k, v in data.items() if v != ""}

    @validates_schema
    def validate_dates(self, data: dict[str, Any], **kwargs: Any) -> None:
        start, end = data.get("start_date"), data.get("end_date")
        if (start is None) != (end is None):
            raise ValidationError(
                "start_date and end_date must be provided together.",
                field_name="start_date",
            )
        if start and end and end < start:
            raise ValidationError(
                "end_date must not be before start_date.", field_name="end_date"
            )

        if data["project_repeating"]:
            if not start:
                raise ValidationError(
                    "project_repeating needs start_date and end_date.",
                    field_name="project_repeating",
                )
            if (end - start).days > MAX_PROJECTION_DAYS:
                raise ValidationError(
                    f"Date range must be {MAX_PROJECTION_DAYS} days or fewer.",
                    field_name="project_repeating",
                )

    @post_load
    def to_query(self, data: dict[str, Any], **kwargs: Any) -> TaskQuery:
        return TaskQuery(**data)


class TaskPageSchema(CamelSchema):
    tasks = fields.Nested(TaskSchema, many=True)
    total_tasks = fields.Integer()
    total_pages = fields.Integer()
    current_page = fields.Integer()
