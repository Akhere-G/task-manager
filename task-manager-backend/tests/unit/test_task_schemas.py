import pytest
from marshmallow import ValidationError

from app.schemas.task_schema import BulkTaskSchema, TaskCreateSchema, TaskSchema
from app.utils.http import flatten_errors, flatten_item_errors

VALID = {
    "title": "  Write report ",
    "category": "work",
    "startAt": "2026-03-02 09:00:00",
    "endAt": "2026-03-02 10:00:00",
}


def errors_for(data, **options):
    with pytest.raises(ValidationError) as caught:
        TaskCreateSchema(**options).load(data)
    return flatten_errors(caught.value.messages)


def test_valid_task_is_trimmed_and_keeps_date_strings():
    task = TaskCreateSchema().load(VALID)
    assert task["title"] == "Write report"
    assert task["startAt"] == "2026-03-02 09:00:00"


@pytest.mark.parametrize(
    "change, field",
    [
        ({"title": "  "}, "title"),
        ({"title": "x" * 256}, "title"),
        ({"category": "nope"}, "category"),
        ({"startAt": "garbage"}, "startAt"),
        ({"endAt": "2026-03-02 08:00:00"}, "endAt"),
        ({"isRepeating": True}, "repeatBy"),
        ({"repeatBy": "hourly"}, "repeatBy"),
        ({"repeatBy": "daily", "repeatUntil": "soon"}, "repeatUntil"),
        ({"isCompleted": True}, "isCompleted"),
        ({"isCompleted": False, "completedAt": "2026-03-02 10:00:00"}, "isCompleted"),
    ],
)
def test_invalid_task_reports_the_offending_field(change, field):
    assert field in errors_for({**VALID, **change})


def test_missing_required_fields_are_reported_once_each():
    assert set(errors_for({})) == {"title", "category", "startAt", "endAt"}


def test_repeat_by_marks_the_task_as_repeating():
    task = TaskCreateSchema().load({**VALID, "repeatBy": "weekly"})
    assert task["isRepeating"] is True


def test_partial_update_only_checks_fields_that_are_sent():
    assert TaskSchema(partial=True).load({"title": "New"}) == {"title": "New"}
    with pytest.raises(ValidationError):
        TaskSchema(partial=True).load({"title": ""})


def test_unknown_fields_are_dropped():
    assert "id" not in TaskCreateSchema().load({**VALID, "id": 5, "userId": 9})


def test_bulk_defaults_completion_and_reports_errors_per_item():
    tasks = BulkTaskSchema(many=True).load([{**VALID, "isCompleted": True}])
    assert tasks[0]["completedAt"]

    with pytest.raises(ValidationError) as caught:
        BulkTaskSchema(many=True).load([VALID, {**VALID, "title": ""}])
    per_item = flatten_item_errors(caught.value.messages, 2)
    assert per_item[0] == {} and "title" in per_item[1]
