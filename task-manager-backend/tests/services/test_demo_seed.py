from collections.abc import Callable

import pytest
from flask import Flask
from sqlalchemy import func, select

from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.demo.seed import reset_demo_account
from app.models import Label, Project, ProjectColumn, Task, User


def test_reset_builds_the_demo_account_and_is_repeatable(
    app: Flask, make_demo_user: Callable[[], int]
) -> None:
    demo_id = make_demo_user()
    with app.app_context():
        db.session.add(Label(user_id=demo_id, name="Visitor label"))
        db.session.commit()

    first = reset_demo_account()
    second = reset_demo_account()

    assert first == second > 50
    with app.app_context():
        demo = db.session.scalar(select(User).where(User.email == DEMO_USER_EMAIL))
        tasks = db.session.scalars(select(Task).where(Task.user_id == demo.id)).all()
        assert len(tasks) == first
        assert db.session.scalar(select(func.count(Label.id))) == 0

        ids = {t.id for t in tasks}
        assert all(t.series_id in ids for t in tasks)
        repeating = [t for t in tasks if t.is_repeating]
        assert repeating and all(t.series_id == t.id for t in repeating)
        history = [t for t in tasks if t.series_id != t.id]
        assert history and all(t.is_completed and not t.is_repeating for t in history)


def test_reset_gives_each_project_its_own_colour_and_fills_the_work_board(
    app: Flask, make_demo_user: Callable[[], int]
) -> None:
    demo_id = make_demo_user()

    reset_demo_account()

    with app.app_context():
        projects = db.session.scalars(
            select(Project).where(Project.user_id == demo_id)
        ).all()
        colours = [p.colour for p in projects]
        assert len(projects) > 1 and len(set(colours)) == len(colours)

        work = next(p for p in projects if p.name == "Work")
        columns = db.session.scalars(
            select(ProjectColumn).where(ProjectColumn.project_id == work.id)
        ).all()
        assert {c.status for c in columns} == {"pending", "in_progress", "done"}

        work_tasks = db.session.scalars(
            select(Task).where(Task.project_id == work.id)
        ).all()
        by_column = {c.id: c.status for c in columns}
        assert work_tasks and all(t.column_id in by_column for t in work_tasks)
        assert {by_column[t.column_id] for t in work_tasks} == set(by_column.values())
        assert all(
            by_column[t.column_id] == "done" for t in work_tasks if t.is_completed
        )


def test_reset_refuses_to_touch_a_real_account(
    app: Flask, make_user: Callable[..., int]
) -> None:
    make_user(email=DEMO_USER_EMAIL, is_demo=False)

    with pytest.raises(RuntimeError):
        reset_demo_account()

    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(Task)) == 0
