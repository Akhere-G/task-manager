from datetime import UTC, date, datetime

import pytest
from marshmallow import ValidationError

from app.errors import flatten_validation_errors
from app.exceptions import AppError, DemoForbidden, TaskConflict
from app.schemas.task_schema import TaskSchema
from app.utils.dates import (
    as_aware_utc,
    as_naive_utc,
    end_of_day,
    get_zone,
    is_valid_zone,
    local_today,
    parse_iso,
    to_iso_z,
)


def test_naive_and_aware_utc_round_trip() -> None:
    aware = datetime(2026, 3, 2, 10, 0, tzinfo=UTC)
    assert as_naive_utc("2026-03-02T11:00:00+01:00") == aware.replace(tzinfo=None)
    assert as_aware_utc(aware.replace(tzinfo=None)) == aware
    assert parse_iso(aware) is aware
    assert to_iso_z(aware.replace(tzinfo=None)) == "2026-03-02T10:00:00Z"
    assert to_iso_z(date(2026, 3, 2)) == "2026-03-02"
    assert end_of_day(date(2026, 3, 2)).hour == 23


def test_zones_fall_back_to_utc() -> None:
    assert get_zone("Not/AZone") is get_zone(None)
    assert is_valid_zone("Europe/London") and not is_valid_zone("Nope")
    assert local_today("Not/AZone") == local_today(None)


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
