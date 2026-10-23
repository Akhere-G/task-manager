import pytest

from app.database import db
from app.models import Task, User


@pytest.fixture
def user_id(app, make_user):
    with app.app_context():
        yield make_user()


def test_new_tasks_get_defaults(user_id, task_payload):
    from app.services.task_service import create_task

    task = db.session.get(Task, create_task(user_id, task_payload()))
    assert task.is_completed is False
    assert task.is_repeating is False
    assert task.created_at is not None


def test_deleting_a_user_deletes_their_tasks(user_id, task_payload):
    from app.services.task_service import create_task

    create_task(user_id, task_payload())
    db.session.delete(db.session.get(User, user_id))
    db.session.commit()
    assert db.session.query(Task).count() == 0
