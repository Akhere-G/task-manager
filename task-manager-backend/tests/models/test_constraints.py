from datetime import date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models import (
    DailyBrief,
    Notification,
    NotificationSubscription,
    PasswordReset,
    RefreshToken,
    Task,
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


def test_a_new_task_gets_the_database_defaults(user_id: int) -> None:
    task = add_task(user_id)

    assert task.category == "General"
    assert task.is_completed is False
    assert task.is_repeating is False
    assert task.repeat_interval == 1
    assert task.created_at is not None


def test_deleting_a_user_deletes_everything_they_own(user_id: int) -> None:
    expires_at = START + timedelta(days=1)
    add_task(user_id)
    add_subscription(user_id, "https://push.example.com/1")
    db.session.add_all(
        [
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
        RefreshToken,
        PasswordReset,
        Notification,
        NotificationSubscription,
        DailyBrief,
    )
    for model in owned:
        assert count(model) == 0, model.__name__


def test_emails_are_unique(user_id: int) -> None:
    db.session.add(
        User(
            first_name="Copy",
            last_name="Cat",
            email="user@example.com",
            password_hash="x",
        )
    )

    with pytest.raises(IntegrityError):
        db.session.commit()


def test_a_push_endpoint_belongs_to_one_subscription(user_id: int) -> None:
    add_subscription(user_id, "https://push.example.com/1")

    with pytest.raises(IntegrityError):
        add_subscription(user_id, "https://push.example.com/1")


def test_a_user_has_at_most_one_brief_per_day(user_id: int) -> None:
    today = date.today()
    db.session.add(DailyBrief(user_id=user_id, brief_text="One", generated_date=today))
    db.session.commit()
    db.session.add(DailyBrief(user_id=user_id, brief_text="Two", generated_date=today))

    with pytest.raises(IntegrityError):
        db.session.commit()
