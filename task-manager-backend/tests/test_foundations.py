import pytest
from marshmallow import ValidationError

from app.errors import flatten_validation_errors
from app.exceptions import AppError, DemoForbidden, TaskConflict
from app.schemas.task_schema import TaskSchema


def test_app_error_payloads() -> None:
    assert DemoForbidden().to_dict() == {"error": "Not available in demo mode."}
    assert AppError("bad", field="title").to_dict() == {"errors": {"title": "bad"}}
    assert TaskConflict({"id": 1}).to_dict()["task"] == {"id": 1}
    assert TaskConflict({"id": 1}).status_code == 409


def test_camel_schema_and_flattened_errors() -> None:
    with pytest.raises(ValidationError) as single:
        TaskSchema().load(
            {
                "title": "x",
                "category": "work",
                "startAt": "2026-03-02T10:00",
                "endAt": "2026-03-02T09:00",
            }
        )
    assert flatten_validation_errors(single.value.messages) == {
        "endAt": "End time must be after the start time."
    }

    with pytest.raises(ValidationError) as bulk:
        TaskSchema(many=True).load([{"title": "x"}, {}])
    errors = flatten_validation_errors(bulk.value.messages)
    assert isinstance(errors, list) and len(errors) == 2
    assert errors[1]["title"] == "Title is required."
