from datetime import datetime
from typing import Any

from marshmallow import fields, pre_load, validate

from app.constants import (
    DEFAULT_PRIORITY,
    MAX_DECOMPOSE_DESCRIPTION_LENGTH,
    MAX_DECOMPOSE_TITLE_LENGTH,
    MAX_EXISTING_SUBTASKS,
    MAX_PARSE_TEXT_LENGTH,
    PRIORITIES,
    REPEAT_FREQUENCIES,
    REPEAT_INTERVAL_LIMITS,
)
from app.utils.dates import utc_now
from app.utils.recurrence import normalise_days

from .base import CamelSchema
from .fields import not_blank


class ParseTaskRequestSchema(CamelSchema):
    text = fields.String(
        required=True,
        validate=[
            not_blank("Text is required."),
            validate.Length(
                max=MAX_PARSE_TEXT_LENGTH,
                error=f"Text must be {MAX_PARSE_TEXT_LENGTH} characters or fewer.",
            ),
        ],
        error_messages={"required": "Text is required."},
    )


class DecomposeRequestSchema(CamelSchema):
    title = fields.String(
        required=True,
        validate=[
            not_blank("Title is required."),
            validate.Length(
                max=MAX_DECOMPOSE_TITLE_LENGTH,
                error=f"Title must be {MAX_DECOMPOSE_TITLE_LENGTH} characters or fewer.",
            ),
        ],
        error_messages={"required": "Title is required."},
    )
    description = fields.String(
        allow_none=True,
        validate=validate.Length(
            max=MAX_DECOMPOSE_DESCRIPTION_LENGTH,
            error=f"Description must be {MAX_DECOMPOSE_DESCRIPTION_LENGTH} characters or fewer.",
        ),
    )
    start_at = fields.String(allow_none=True)
    end_at = fields.String(allow_none=True)
    existing_subtasks = fields.List(
        fields.String(validate=validate.Length(max=MAX_DECOMPOSE_TITLE_LENGTH)),
        validate=validate.Length(max=MAX_EXISTING_SUBTASKS),
        load_default=list,
    )


def _end_of_today() -> str:
    return utc_now().strftime("%Y-%m-%d 23:59:59")


def _clean_recurrence(data: dict[str, Any]) -> dict[str, Any]:
    """Drop anything the model got wrong so the form always gets a usable pattern."""
    repeat_by = data.get("repeatBy")
    if repeat_by not in REPEAT_FREQUENCIES:
        return {
            "isRepeating": False,
            "repeatBy": None,
            "repeatInterval": 1,
            "repeatDays": None,
            "repeatUntil": None,
        }

    try:
        interval = int(data.get("repeatInterval") or 1)
    except (TypeError, ValueError):
        interval = 1
    days = data.get("repeatDays")
    until = data.get("repeatUntil")
    try:
        datetime.strptime(str(until), "%Y-%m-%d")
    except ValueError:
        until = None

    return {
        "isRepeating": True,
        "repeatBy": repeat_by,
        "repeatInterval": min(max(interval, 1), REPEAT_INTERVAL_LIMITS[repeat_by]),
        "repeatDays": normalise_days(repeat_by, days if isinstance(days, list) else [])
        or None,
        "repeatUntil": until,
    }


class AiTaskSchema(CamelSchema):
    """A task described by a model. Wrong or missing parts are repaired, not rejected."""

    title = fields.String(required=True)
    description = fields.String(allow_none=True)
    project = fields.String(allow_none=True)
    priority = fields.Raw()
    start_at = fields.String(load_default=_end_of_today)
    end_at = fields.String(load_default=_end_of_today)
    is_repeating = fields.Boolean()
    repeat_by = fields.String(allow_none=True)
    repeat_interval = fields.Integer()
    repeat_days = fields.List(fields.Raw(), allow_none=True)
    repeat_until = fields.String(allow_none=True)

    @pre_load
    def repair(self, data: Any, **kwargs: Any) -> Any:
        if not isinstance(data, dict):
            return data
        repaired = {**data, **_clean_recurrence(data)}
        if repaired.get("priority") not in PRIORITIES:
            repaired["priority"] = DEFAULT_PRIORITY
        if not isinstance(repaired.get("project"), str):
            repaired.pop("project", None)
        for key in ("startAt", "endAt"):
            if not repaired.get(key):
                repaired.pop(key, None)
        return repaired
