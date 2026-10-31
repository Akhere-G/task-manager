from datetime import datetime
from typing import Any

import pytest

from app.models import Task
from app.schemas.task_schema import TaskRescheduleSchema, TaskSchema, TaskUpdateSchema
from tests.builders import MONDAY, TUESDAY, reschedule_body, task_body
from tests.schemas.helpers import load_errors

TASK = task_body()
RESCHEDULE = reschedule_body(MONDAY, TUESDAY)


def test_a_task_is_loaded_as_naive_utc_and_starts_incomplete() -> None:
    data = TaskSchema().load({**TASK, "startAt": "2026-03-02T11:00:00+01:00"})

    assert data["start_at"] == datetime(2026, 3, 2, 10, 0)
    assert data["is_completed"] is False
    assert data["completed_at"] is None


def test_end_must_be_after_start() -> None:
    body = {**TASK, "endAt": TASK["startAt"]}

    assert load_errors(TaskSchema(), body) == {
        "endAt": "End time must be after the start time."
    }


def test_a_frequency_makes_the_task_repeat() -> None:
    assert TaskSchema().load({**TASK, "repeatBy": "weekly"})["is_repeating"] is True


def test_blank_optional_strings_are_treated_as_missing() -> None:
    data = TaskSchema().load({**TASK, "description": "", "repeatBy": ""})

    assert data["description"] is None
    assert data["repeat_by"] is None


@pytest.mark.parametrize(
    "recurrence, field, message",
    [
        (
            {"isRepeating": True},
            "repeatBy",
            "Repeat By is required for repeating tasks.",
        ),
        (
            {"repeatBy": "weekly", "repeatInterval": 53},
            "repeatInterval",
            "Repeat interval must be between 1 and 52.",
        ),
        (
            {"repeatBy": "daily", "repeatDays": [1]},
            "repeatDays",
            "Daily tasks do not use repeat days.",
        ),
        (
            {"repeatBy": "weekly", "repeatDays": []},
            "repeatDays",
            "Choose at least one day.",
        ),
        (
            {"repeatBy": "weekly", "repeatDays": [1, 1]},
            "repeatDays",
            "Repeat days must not contain duplicates.",
        ),
        (
            {"repeatBy": "weekly", "repeatDays": [7]},
            "repeatDays",
            "Weekly repeat days must be weekdays (0 to 6).",
        ),
        (
            {"repeatBy": "monthly", "repeatDays": [0]},
            "repeatDays",
            "Monthly repeat days must be between 1 and 31.",
        ),
        (
            {"repeatBy": "yearly", "repeatDays": ["02-30"]},
            "repeatDays",
            "Yearly repeat days must be dates formatted MM-DD.",
        ),
        (
            {"repeatBy": "weekly", "repeatTimezone": "Mars/Base"},
            "repeatTimezone",
            "Repeat time zone is not a valid time zone.",
        ),
    ],
)
def test_recurrence_rules(recurrence: dict[str, Any], field: str, message: str) -> None:
    assert load_errors(TaskSchema(), {**TASK, **recurrence}) == {field: message}


def test_bulk_errors_line_up_with_their_rows() -> None:
    errors = load_errors(TaskSchema(many=True), [TASK, {**TASK, "title": ""}])

    assert errors == [{}, {"title": "Title must be 1 to 255 characters."}]


def test_an_update_may_send_any_subset_of_fields() -> None:
    assert TaskUpdateSchema().load({"title": "Renamed"}) == {"title": "Renamed"}


def test_an_update_cannot_change_when_the_task_was_created() -> None:
    assert TaskUpdateSchema().load({"createdAt": "2020-01-01 00:00:00"}) == {}


def test_a_reschedule_is_loaded_as_naive_utc() -> None:
    data = TaskRescheduleSchema().load(
        {**RESCHEDULE, "startAt": "2026-03-03T10:00+01:00"}
    )

    assert data["start_at"] == datetime(2026, 3, 3, 9, 0)
    assert data["is_ghost"] is False


@pytest.mark.parametrize(
    "override, field",
    [
        ({"previousEndAt": RESCHEDULE["previousStartAt"]}, "previousEndAt"),
        ({"endAt": RESCHEDULE["startAt"]}, "endAt"),
        ({"isGhost": "yes"}, "isGhost"),
        ({"startAt": "tomorrow"}, "startAt"),
    ],
)
def test_reschedule_rejects_bad_times_and_loose_flags(
    override: dict[str, Any], field: str
) -> None:
    assert field in load_errors(TaskRescheduleSchema(), {**RESCHEDULE, **override})


def test_reschedule_needs_every_field() -> None:
    assert set(load_errors(TaskRescheduleSchema(), {})) == set(RESCHEDULE)


def test_saved_tasks_are_sent_as_not_ghosts() -> None:
    saved = Task(
        title="Gym", start_at=datetime(2026, 3, 2, 9), end_at=datetime(2026, 3, 2, 10)
    )
    ghost = Task(
        title="Gym", start_at=datetime(2026, 3, 9, 9), end_at=datetime(2026, 3, 9, 10)
    )
    ghost.is_ghost = True

    assert TaskSchema().dump(saved)["isGhost"] is False
    assert TaskSchema().dump(ghost)["isGhost"] is True
