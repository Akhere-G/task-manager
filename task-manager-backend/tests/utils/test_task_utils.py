from typing import Any

import pytest

from app.models import Task
from app.schemas.task_schema import TaskSchema
from app.utils.task_utils import should_roll_series
from tests.builders import MONDAY, task_body


def daily_task(**overrides: Any) -> Task:
    body = task_body(startAt=MONDAY[0], endAt=MONDAY[1], repeatBy="daily", **overrides)
    return Task(**TaskSchema().load(body))


def test_completing_an_open_ended_occurrence_rolls_the_series() -> None:
    assert should_roll_series(daily_task(isCompleted=True), daily_task())


@pytest.mark.parametrize(
    ("repeat_until", "rolls"),
    [("2026-03-03", True), ("2026-03-02", False)],
)
def test_the_series_rolls_only_while_the_next_occurrence_is_in_range(
    repeat_until: str, rolls: bool
) -> None:
    task = daily_task(isCompleted=True, repeatUntil=repeat_until)

    assert should_roll_series(task, daily_task()) is rolls


def test_a_task_that_was_already_complete_does_not_roll_again() -> None:
    task = daily_task(isCompleted=True)

    assert not should_roll_series(task, daily_task(isCompleted=True))


def test_a_non_repeating_task_never_rolls() -> None:
    task = Task(**TaskSchema().load(task_body(isCompleted=True)))

    assert not should_roll_series(task, Task(**TaskSchema().load(task_body())))
