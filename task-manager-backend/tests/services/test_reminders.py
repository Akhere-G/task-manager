from collections.abc import Callable, Iterator
from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from flask import Flask
from sqlalchemy import select

import app.run_reminders as run_reminders
from app.database import db
from app.models import (
    Notification,
    NotificationSubscription,
    Project,
    Task,
    TaskReminder,
)
from app.services.reminder_service import set_reminders, sync_reminders
from app.services.task_service import update_task
from app.utils.dates import utc_now


@pytest.fixture
def user_with_subscription(app: Flask, make_user: Callable[..., int]) -> int:
    user_id = make_user()
    with app.app_context():
        db.session.add(
            NotificationSubscription(
                user_id=user_id,
                endpoint="https://push.example/abc",
                p256dh="k",
                auth="a",
            )
        )
        db.session.commit()
    return user_id


@pytest.fixture
def add_task(app: Flask) -> Callable[..., int]:
    def _add(user_id: int, **fields: Any) -> int:
        start = fields.pop("start_at", utc_now() + timedelta(minutes=10))
        with app.app_context():
            task = Task(
                user_id=user_id,
                title="Standup",
                start_at=start,
                end_at=start + timedelta(hours=1),
                **fields,
            )
            db.session.add(task)
            db.session.flush()
            set_reminders(task, [{"kind": "before", "minutes_before": 30}])
            db.session.commit()
            return task.id

    return _add


@pytest.fixture
def push() -> Iterator[mock.MagicMock]:
    with mock.patch.object(run_reminders, "webpush") as webpush:
        yield webpush


def notification_count(app: Flask) -> int:
    with app.app_context():
        return db.session.query(Notification).count()


def test_each_upcoming_task_is_reminded_once(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    add_task(user_with_subscription)

    run_reminders.check_task_reminders()
    run_reminders.check_task_reminders()

    assert push.call_count == 1
    assert notification_count(app) == 1


def test_completed_tasks_are_not_reminded(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    add_task(user_with_subscription, is_completed=True)

    run_reminders.check_task_reminders()

    assert push.call_count == 0
    assert notification_count(app) == 0


def test_deleted_tasks_are_not_reminded(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    add_task(user_with_subscription, is_deleted=True, deleted_at=utc_now())

    run_reminders.check_task_reminders()

    assert push.call_count == 0
    assert notification_count(app) == 0


def test_rescheduled_task_is_reminded_again(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    task_id = add_task(user_with_subscription)
    run_reminders.check_task_reminders()

    with app.app_context():
        task = db.session.get(Task, task_id)
        task.start_at = utc_now() + timedelta(minutes=20)
        sync_reminders(task)
        db.session.commit()
    run_reminders.check_task_reminders()

    assert push.call_count == 2


def test_completing_a_repeating_task_moves_its_reminder_to_the_next_occurrence(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
) -> None:
    task_id = add_task(
        user_with_subscription,
        is_repeating=True,
        repeat_by="daily",
        repeat_interval=1,
    )

    with app.app_context():
        task = update_task(user_with_subscription, task_id, {"is_completed": True})
        reminder = db.session.scalar(
            select(TaskReminder).where(TaskReminder.task_id == task_id)
        )
        assert reminder.fire_at == task.start_at - timedelta(minutes=30)
        assert task.start_at > utc_now() + timedelta(hours=23)


@pytest.mark.parametrize(
    ("project_name", "description", "message"),
    [(None, None, "Inbox"), ("Work", "Weekly sync", "Work -- Weekly sync")],
)
def test_the_message_names_the_project_and_never_says_none(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
    project_name: str | None,
    description: str | None,
    message: str,
) -> None:
    fields: dict[str, Any] = {"description": description}
    if project_name:
        with app.app_context():
            project = Project(user_id=user_with_subscription, name=project_name)
            db.session.add(project)
            db.session.commit()
            fields["project_id"] = project.id
    add_task(user_with_subscription, **fields)

    run_reminders.check_task_reminders()

    with app.app_context():
        assert db.session.query(Notification).one().message == message


def test_undated_tasks_are_not_reminded(
    app: Flask, user_with_subscription: int, push: mock.MagicMock
) -> None:
    with app.app_context():
        db.session.add(Task(user_id=user_with_subscription, title="Someday"))
        db.session.commit()

    run_reminders.check_task_reminders()

    assert push.call_count == 0
    assert notification_count(app) == 0


def test_several_reminders_each_fire_once(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    task_id = add_task(user_with_subscription)
    with app.app_context():
        task = db.session.get(Task, task_id)
        set_reminders(
            task,
            [
                {"kind": "before", "minutes_before": 60},
                {"kind": "before", "minutes_before": 15},
            ],
        )
        db.session.commit()

    run_reminders.check_task_reminders()
    run_reminders.check_task_reminders()

    assert push.call_count == 2


def test_a_reminder_past_its_grace_window_is_dropped(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    add_task(user_with_subscription, start_at=utc_now() + timedelta(minutes=10))
    with app.app_context():
        reminder = db.session.query(TaskReminder).one()
        reminder.fire_at = utc_now() - timedelta(hours=3)
        db.session.commit()

    run_reminders.check_task_reminders()

    assert push.call_count == 0


def test_subtasks_are_not_reminded(
    app: Flask,
    user_with_subscription: int,
    add_task: Callable[..., int],
    push: mock.MagicMock,
) -> None:
    parent_id = add_task(user_with_subscription, start_at=utc_now() + timedelta(days=3))
    add_task(user_with_subscription, parent_id=parent_id)

    run_reminders.check_task_reminders()

    assert push.call_count == 0
