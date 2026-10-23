from datetime import datetime, timedelta

import pytest

from app.database import db
from app.models import Task
from app.services import task_service
from app.services.task_query import TaskQuery


@pytest.fixture
def ctx(app):
    with app.app_context():
        yield


@pytest.fixture
def user_id(ctx, make_user):
    return make_user()


def add(user_id, task_payload, **overrides):
    return task_service.create_task(user_id, task_payload(**overrides))


def titles(user_id, **query):
    result = task_service.get_all_tasks(user_id, TaskQuery(**query))
    return [t["title"] for t in result["tasks"]]


def test_created_tasks_are_trimmed_and_belong_to_their_series(user_id, task_payload):
    task_id = add(user_id, task_payload, title="Write report", description="  notes ")
    task = db.session.get(Task, task_id)
    assert task.description == "notes"
    assert task.series_id == task.id


def test_filters_by_category_and_completion(user_id, task_payload):
    add(user_id, task_payload, title="Work one", category="work")
    done = add(user_id, task_payload, title="Home one", category="home")
    db.session.get(Task, done).is_completed = True
    db.session.commit()

    assert titles(user_id, category="home") == ["Home one"]
    assert titles(user_id, is_completed="true") == ["Home one"]
    assert titles(user_id, is_completed="false") == ["Work one"]


def test_search_matches_word_prefixes_and_short_words(user_id, task_payload):
    add(user_id, task_payload, title="Quarterly budget report", description="Finance")
    add(user_id, task_payload, title="Go gym", description="Leg day")

    assert titles(user_id, search="budg") == ["Quarterly budget report"]
    assert titles(user_id, search="quarterly holiday") == []
    assert titles(user_id, search="go") == ["Go gym"]
    assert titles(user_id, search="go%") == []
    assert len(titles(user_id, search="%")) == 2
    assert titles(user_id, search='foo (bar "') == []


def test_listing_is_paged_and_scoped_to_the_user(user_id, make_user, task_payload):
    other = make_user("other@example.com")
    for n in range(5):
        add(user_id, task_payload, title=f"Task {n}")
    add(other, task_payload, title="Not mine")

    page = task_service.get_all_tasks(user_id, TaskQuery(limit=2, page=3, sort_by="title"))
    assert [t["title"] for t in page["tasks"]] == ["Task 4"]
    assert page["total_tasks"] == 5 and page["total_pages"] == 3


def test_recurring_tasks_are_projected_into_the_requested_range(user_id, task_payload):
    add(
        user_id,
        task_payload,
        startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00",
        repeatBy="daily",
        isRepeating=True,
    )
    result = task_service.get_all_tasks(
        user_id,
        TaskQuery(start_date="2026-03-03", end_date="2026-03-06", project_repeating=True),
    )
    ghosts = [t for t in result["tasks"] if t.get("is_ghost")]
    assert len(ghosts) == 3


def test_completing_a_repeating_task_records_it_and_moves_to_the_next_day(user_id, task_payload):
    task_id = add(
        user_id, task_payload, startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00", repeatBy="daily", isRepeating=True,
    )

    result = task_service.update_task(user_id, task_id, {"isCompleted": True})

    assert result["start_at"] == datetime(2026, 3, 3, 9, 0)
    current = db.session.get(Task, task_id)
    assert current.is_completed is False
    assert current.start_at == datetime(2026, 3, 3, 9, 0)
    history = db.session.query(Task).filter(Task.id != task_id).one()
    assert history.is_completed and history.start_at == datetime(2026, 3, 2, 9, 0)


def test_completing_the_same_occurrence_twice_conflicts(user_id, task_payload):
    task_id = add(
        user_id, task_payload, startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00", repeatBy="daily", isRepeating=True,
    )
    change = {"isCompleted": True, "expectedStartAt": "2026-03-02 09:00:00"}

    task_service.update_task(user_id, task_id, change)
    with pytest.raises(task_service.TaskConflict):
        task_service.update_task(user_id, task_id, change)
    assert db.session.query(Task).count() == 2


def test_end_time_is_checked_against_the_stored_start_time(user_id, task_payload):
    task_id = add(user_id, task_payload)
    with pytest.raises(task_service.TaskValidationError):
        task_service.update_task(user_id, task_id, {"endAt": "2026-03-02 09:00:00"})


def test_other_users_tasks_cannot_be_changed_or_deleted(user_id, make_user, task_payload):
    task_id = add(user_id, task_payload)
    intruder = make_user("intruder@example.com")

    assert task_service.update_task(intruder, task_id, {"title": "Hijacked"}) is None
    assert task_service.delete_task(intruder, task_id) is None
    assert task_service.delete_task(user_id, task_id) == task_id
    assert task_service.get_task(user_id, task_id) is None


def test_bulk_creation_inserts_every_task(user_id, task_payload):
    tasks = [task_payload(title=f"Imported {n}") for n in range(3)]
    assert task_service.create_tasks_from_list(user_id, tasks) == 3
    assert len(titles(user_id)) == 3
