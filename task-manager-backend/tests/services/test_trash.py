from datetime import timedelta
from typing import Any

import pytest
from sqlalchemy import select

from app.database import db
from app.models import Task
from app.utils.dates import utc_now
from tests.builders import add_task

pytestmark = pytest.mark.integration


def trash_at(task: Task, age: timedelta) -> None:
    task.is_deleted = True
    task.deleted_at = utc_now() - age
    db.session.commit()


def stored_titles(user_id: int | None = None) -> set[str]:
    stmt = select(Task.title)
    if user_id is not None:
        stmt = stmt.where(Task.user_id == user_id)
    return set(db.session.scalars(stmt))


def test_creating_a_task_purges_trash_older_than_thirty_days(user_id: int) -> None:
    old = add_task(user_id, title="Old")
    recent = add_task(user_id, title="Recent")
    live = add_task(user_id, title="Live")
    trash_at(old, timedelta(days=31))
    trash_at(recent, timedelta(days=29))

    add_task(user_id, title="Trigger")

    assert stored_titles() == {"Recent", "Live", "Trigger"}
    assert db.session.get(Task, live.id) is not None


def test_a_users_purge_leaves_other_users_trash_alone(
    user_id: int, make_user: Any
) -> None:
    other = make_user("other@example.com")
    theirs = add_task(other, title="Theirs")
    trash_at(theirs, timedelta(days=90))

    add_task(user_id, title="Mine")

    assert "Theirs" in stored_titles(other)
