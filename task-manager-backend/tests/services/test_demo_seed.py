from collections.abc import Callable

import pytest
from flask import Flask
from sqlalchemy import func, select

from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.demo.seed import reset_demo_account
from app.models import Task, User


def test_reset_builds_the_demo_account_and_is_repeatable(
    app: Flask, make_demo_user: Callable[[], int]
) -> None:
    make_demo_user()

    first = reset_demo_account()
    second = reset_demo_account()

    assert first == second > 50
    with app.app_context():
        demo = db.session.scalar(select(User).where(User.email == DEMO_USER_EMAIL))
        tasks = db.session.scalars(select(Task).where(Task.user_id == demo.id)).all()
        assert len(tasks) == first

        ids = {t.id for t in tasks}
        assert all(t.series_id in ids for t in tasks)
        repeating = [t for t in tasks if t.is_repeating]
        assert repeating and all(t.series_id == t.id for t in repeating)
        history = [t for t in tasks if t.series_id != t.id]
        assert history and all(t.is_completed and not t.is_repeating for t in history)


def test_reset_refuses_to_touch_a_real_account(
    app: Flask, make_user: Callable[..., int]
) -> None:
    make_user(email=DEMO_USER_EMAIL, is_demo=False)

    with pytest.raises(RuntimeError):
        reset_demo_account()

    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(Task)) == 0
