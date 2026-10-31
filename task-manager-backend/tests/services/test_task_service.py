from datetime import date, datetime
from typing import Any

import pytest

from app.exceptions import TaskConflict
from app.models import Task
from app.schemas.task_schema import (
    TaskListQuerySchema,
    TaskRescheduleSchema,
    TaskUpdateSchema,
)
from app.services.task_service import (
    get_all_tasks,
    reschedule_task,
    update_task,
)
from app.utils.dates import as_naive_utc
from tests.builders import MONDAY, NEXT_MONDAY, Slot, add_task, reschedule_body


def edit(user_id: int, task: Task, **changes: Any) -> Task:
    return update_task(user_id, task.id, TaskUpdateSchema().load(changes))


def move(user_id: int, task: Task, previous: Slot, new: Slot, is_ghost: bool) -> Task:
    body = reschedule_body(previous, new, is_ghost)
    return reschedule_task(user_id, task.id, TaskRescheduleSchema().load(body))


def ghost_starts(user_id: int, start_date: str, end_date: str) -> list[datetime]:
    query = TaskListQuerySchema().load(
        {
            "start_date": start_date,
            "end_date": f"{end_date}T23:59:59",
            "project_repeating": "true",
        }
    )
    tasks = get_all_tasks(user_id, query)["tasks"]
    starts = []
    for task in tasks:
        if getattr(task, "is_ghost", False):
            starts.append(as_naive_utc(task.start_at))
    return starts


def at(text: str) -> datetime:
    return datetime.fromisoformat(text)


def test_changing_frequency_resets_days_to_the_starts_own_day(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly", repeatDays=[0, 3])

    task = edit(user_id, task, repeatBy="monthly")

    assert task.repeat_days == [2]


def test_turning_repetition_off_clears_the_recurrence(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly", repeatInterval=2)

    task = edit(user_id, task, isRepeating=False)

    assert task.repeat_days is None
    assert task.repeat_interval == 1


def test_skipping_moves_to_the_next_occurrence(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly", repeatDays=[0, 3])

    task = edit(user_id, task, skipOccurrence=True)

    assert task.start_at == at("2026-03-05 09:00")
    assert task.is_completed is False


def test_completing_the_last_occurrence_ends_the_series(user_id: int) -> None:
    task = add_task(user_id, repeatBy="daily", repeatUntil="2026-03-02")

    task = edit(user_id, task, isCompleted=True)

    assert task.is_completed is True
    assert task.start_at == at(MONDAY[0])


def test_moving_a_one_off_task_sets_the_new_times(user_id: int) -> None:
    task = add_task(user_id)

    task = move(
        user_id, task, MONDAY, ("2026-03-04 15:00:00", "2026-03-04 17:00:00"), False
    )

    assert (task.start_at, task.end_at) == (
        at("2026-03-04 15:00"),
        at("2026-03-04 17:00"),
    )


def test_moving_a_daily_ghost_offsets_the_whole_series(user_id: int) -> None:
    task = add_task(user_id, repeatBy="daily")

    task = move(
        user_id,
        task,
        ("2026-03-04 09:00:00", "2026-03-04 10:00:00"),
        ("2026-03-04 11:00:00", "2026-03-04 12:30:00"),
        True,
    )

    assert (task.start_at, task.end_at) == (
        at("2026-03-02 11:00"),
        at("2026-03-02 12:30"),
    )
    assert ghost_starts(user_id, "2026-03-03", "2026-03-03") == [at("2026-03-03 11:00")]


def test_moving_a_weekly_task_to_another_day_does_not_jump_a_week(
    user_id: int,
) -> None:
    task = add_task(user_id, repeatBy="weekly")

    task = move(
        user_id, task, MONDAY, ("2026-03-03 09:00:00", "2026-03-03 10:00:00"), False
    )

    assert task.start_at == at("2026-03-03 09:00")
    assert task.repeat_days == [1]


def test_moving_a_weekly_ghost_swaps_its_day(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly")

    task = move(
        user_id, task, NEXT_MONDAY, ("2026-03-10 09:00:00", "2026-03-10 10:00:00"), True
    )

    assert task.repeat_days == [1]
    assert task.start_at == at("2026-03-03 09:00")
    assert ghost_starts(user_id, "2026-03-09", "2026-03-15") == [at("2026-03-10 09:00")]


def test_moving_a_ghost_from_a_later_week_keeps_the_series_rhythm(
    user_id: int,
) -> None:
    task = add_task(user_id, repeatBy="weekly")

    task = move(
        user_id,
        task,
        ("2026-03-16 09:00:00", "2026-03-16 10:00:00"),
        ("2026-03-17 09:00:00", "2026-03-17 10:00:00"),
        True,
    )

    assert task.start_at == at("2026-03-03 09:00")
    assert ghost_starts(user_id, "2026-03-09", "2026-03-22") == [
        at("2026-03-10 09:00"),
        at("2026-03-17 09:00"),
    ]


def test_moving_a_ghost_onto_a_chosen_day_merges_them(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly", repeatDays=[0, 2])

    task = move(
        user_id, task, NEXT_MONDAY, ("2026-03-11 09:00:00", "2026-03-11 10:00:00"), True
    )

    assert task.repeat_days == [2]


def test_moving_a_ghost_to_another_time_moves_the_series_time(user_id: int) -> None:
    task = add_task(user_id, repeatBy="weekly")

    task = move(
        user_id, task, NEXT_MONDAY, ("2026-03-10 14:00:00", "2026-03-10 14:30:00"), True
    )

    assert (task.start_at, task.end_at) == (
        at("2026-03-03 14:00"),
        at("2026-03-03 14:30"),
    )


def test_series_time_is_kept_in_the_series_zone(user_id: int) -> None:
    task = add_task(
        user_id,
        startAt="2026-07-06 08:00:00",
        endAt="2026-07-06 09:00:00",
        repeatBy="weekly",
        repeatTimezone="Europe/London",
    )

    task = move(
        user_id,
        task,
        ("2026-07-13 08:00:00", "2026-07-13 09:00:00"),
        ("2026-07-14 13:00:00", "2026-07-14 14:00:00"),
        True,
    )

    assert task.repeat_days == [1]
    assert task.start_at == at("2026-07-07 13:00")


def test_moving_a_clamped_monthly_ghost_replaces_the_day_it_stands_for(
    user_id: int,
) -> None:
    task = add_task(
        user_id,
        startAt="2026-01-31 09:00:00",
        endAt="2026-01-31 10:00:00",
        repeatBy="monthly",
        repeatDays=[31],
    )

    task = move(
        user_id,
        task,
        ("2026-02-28 09:00:00", "2026-02-28 10:00:00"),
        ("2026-02-15 09:00:00", "2026-02-15 10:00:00"),
        True,
    )

    assert task.repeat_days == [15]
    assert task.start_at == at("2026-02-15 09:00")


def test_moving_a_yearly_ghost_changes_its_date(user_id: int) -> None:
    task = add_task(
        user_id,
        startAt="2026-12-25 09:00:00",
        endAt="2026-12-25 10:00:00",
        repeatBy="yearly",
    )

    task = move(
        user_id,
        task,
        ("2027-12-25 09:00:00", "2027-12-25 10:00:00"),
        ("2027-12-24 09:00:00", "2027-12-24 10:00:00"),
        True,
    )

    assert task.repeat_days == ["12-24"]
    assert task.start_at.date() == date(2027, 12, 24)


def test_moving_an_occurrence_that_has_already_moved_on_is_a_conflict(
    user_id: int,
) -> None:
    task = add_task(user_id, repeatBy="weekly")

    with pytest.raises(TaskConflict):
        move(
            user_id,
            task,
            NEXT_MONDAY,
            ("2026-03-10 09:00:00", "2026-03-10 10:00:00"),
            False,
        )
