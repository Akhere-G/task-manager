from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest

import app.run_reminders as run_reminders
from app.database import db
from app.models import Notification, NotificationSubscription, Task


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
def user_with_subscription(app, make_user):
    user_id = make_user()
    with app.app_context():
        db.session.add(
            NotificationSubscription(
                user_id=user_id, endpoint="https://push.example/abc", p256dh="k", auth="a"
            )
        )
        db.session.commit()
    return user_id


@pytest.fixture
def add_task(app):
    def _add(user_id, **fields):
        start = fields.pop("start_at", now() + timedelta(minutes=10))
        with app.app_context():
            task = Task(
                user_id=user_id,
                title="Standup",
                category="work",
                start_at=start,
                end_at=start + timedelta(hours=1),
                **fields,
            )
            db.session.add(task)
            db.session.commit()
            return task.id

    return _add


@pytest.fixture
def push():
    with mock.patch.object(run_reminders, "webpush") as webpush:
        yield webpush


def notification_count(app):
    with app.app_context():
        return db.session.query(Notification).count()


def test_each_upcoming_task_is_reminded_once(app, user_with_subscription, add_task, push):
    add_task(user_with_subscription)

    run_reminders.check_task_reminders()
    run_reminders.check_task_reminders()

    assert push.call_count == 1
    assert notification_count(app) == 1


def test_completed_tasks_are_not_reminded(app, user_with_subscription, add_task, push):
    add_task(user_with_subscription, is_completed=True)

    run_reminders.check_task_reminders()

    assert push.call_count == 0
    assert notification_count(app) == 0


def test_rescheduled_task_is_reminded_again(app, user_with_subscription, add_task, push):
    task_id = add_task(user_with_subscription)
    run_reminders.check_task_reminders()

    with app.app_context():
        task = db.session.get(Task, task_id)
        task.start_at = now() + timedelta(minutes=20)
        db.session.commit()
    run_reminders.check_task_reminders()

    assert push.call_count == 2


def test_message_has_no_none_when_task_has_no_description(app, user_with_subscription, add_task, push):
    add_task(user_with_subscription, description=None)

    run_reminders.check_task_reminders()

    with app.app_context():
        assert db.session.query(Notification).one().message == "work"
