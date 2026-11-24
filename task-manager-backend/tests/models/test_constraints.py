from datetime import date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.database import db
from app.models import (
    ApiToken,
    DailyBrief,
    Label,
    Notification,
    NotificationSubscription,
    PasswordReset,
    Project,
    RefreshToken,
    Task,
    TaskReminder,
    TokenScope,
    User,
)

START = datetime(2026, 3, 2, 9, 0)


def add_task(user_id: int, **overrides: Any) -> Task:
    task = Task(
        title="Write report",
        start_at=START,
        end_at=START + timedelta(hours=1),
        user_id=user_id,
        **overrides,
    )
    db.session.add(task)
    db.session.commit()
    db.session.refresh(task)
    return task


def add_subscription(user_id: int, endpoint: str) -> None:
    db.session.add(
        NotificationSubscription(
            user_id=user_id, endpoint=endpoint, p256dh="key", auth="secret"
        )
    )
    db.session.commit()


def count(model: type) -> int:
    return db.session.scalar(select(func.count()).select_from(model))


def test_deleting_a_user_deletes_everything_they_own(user_id: int) -> None:
    expires_at = START + timedelta(days=1)
    task = add_task(user_id)
    add_subscription(user_id, "https://push.example.com/1")
    db.session.add_all(
        [
            ApiToken(
                user_id=user_id,
                name="laptop",
                token_hash="c" * 64,
                prefix="tm_abcde",
                scope=TokenScope.READ,
            ),
            Project(user_id=user_id, name="Work"),
            Label(user_id=user_id, name="Urgent"),
            TaskReminder(task_id=task.id, kind="before", minutes_before=30),
            RefreshToken(user_id=user_id, token_hash="a" * 64, expires_at=expires_at),
            PasswordReset(user_id=user_id, token_hash="b" * 64, expires_at=expires_at),
            Notification(user_id=user_id, title="Reminder", message="Soon"),
            DailyBrief(user_id=user_id, brief_text="Plan", generated_date=date.today()),
        ]
    )
    db.session.commit()

    db.session.delete(db.session.get(User, user_id))
    db.session.commit()

    owned = (
        Task,
        TaskReminder,
        ApiToken,
        Project,
        Label,
        RefreshToken,
        PasswordReset,
        Notification,
        NotificationSubscription,
        DailyBrief,
    )
    for model in owned:
        assert count(model) == 0, model.__name__


def test_a_push_endpoint_belongs_to_one_subscription(user_id: int) -> None:
    add_subscription(user_id, "https://push.example.com/1")

    with pytest.raises(IntegrityError):
        add_subscription(user_id, "https://push.example.com/1")


@pytest.mark.parametrize("priority", [0, 5])
def test_priority_must_be_one_to_four(user_id: int, priority: int) -> None:
    with pytest.raises((IntegrityError, OperationalError)):
        add_task(user_id, priority=priority)
    db.session.rollback()
