from marshmallow import EXCLUDE, Schema, ValidationError, fields, post_load, pre_load, validate, validates_schema

from app.schemas.constants import MAX_PAGE_SIZE, MAX_PROJECTION_DAYS
from app.schemas.fields import parse_naive_utc
from app.services.task_query import TaskQuery
from dateutil import parser


class IsoDateParam(fields.String):
    default_error_messages = {"invalid": "Invalid date. Use ISO format."}

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            parser.isoparse(text)
        except (ValueError, TypeError):
            raise self.make_error("invalid")
        return text


class TaskListQuerySchema(Schema):
    class Meta:
        unknown = EXCLUDE

    category = fields.String()
    search = fields.String(data_key="q")
    duration = fields.String()
    is_completed = fields.String()
    sort_by = fields.String()
    order = fields.String()
    start_date = IsoDateParam()
    end_date = IsoDateParam()
    page = fields.Integer(
        load_default=1,
        validate=validate.Range(min=1, error="page must be at least 1."),
        error_messages={"invalid": "page must be an integer."},
    )
    limit = fields.Integer(
        load_default=None,
        validate=validate.Range(
            min=1, max=MAX_PAGE_SIZE, error=f"limit must be between 1 and {MAX_PAGE_SIZE}."
        ),
        error_messages={"invalid": "limit must be an integer."},
    )
    project_repeating = fields.Boolean(load_default=False)

    @pre_load
    def clean_params(self, data, **kwargs):
        data = {key: value for key, value in data.items() if value != ""}
        data["project_repeating"] = data.get("project_repeating") == "true"
        return data

    @validates_schema(skip_on_field_errors=False)
    def check_date_range(self, data, **kwargs):
        errors = {}
        start, end = data.get("start_date"), data.get("end_date")

        if bool(start) != bool(end):
            errors["start_date"] = "start_date and end_date must be provided together."
        elif start and end:
            start_dt, end_dt = parse_naive_utc(start), parse_naive_utc(end)
            if end_dt < start_dt:
                errors["end_date"] = "end_date must not be before start_date."
            elif data.get("project_repeating") and (end_dt - start_dt).days > MAX_PROJECTION_DAYS:
                errors["project_repeating"] = (
                    f"Date range must be {MAX_PROJECTION_DAYS} days or fewer."
                )

        if data.get("project_repeating") and not (start and end):
            errors["project_repeating"] = "project_repeating needs start_date and end_date."

        if errors:
            raise ValidationError(errors)

    @post_load
    def build_query(self, data, **kwargs):
        return TaskQuery(**data)
