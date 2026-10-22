import pytest


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


def create_daily_task(session, task_payload):
    response = session.post(
        "/api/tasks",
        json=task_payload(
            startAt="2026-03-02 09:00:00", endAt="2026-03-02 10:00:00", repeatBy="daily"
        ),
    )
    assert response.status_code == 201
    return response.get_json()["id"]


def complete(session, task_id, **extra):
    return session.patch(
        f"/api/tasks/{task_id}",
        json={"isCompleted": True, "completedAt": "2026-03-02 10:30:00", **extra},
    )


def all_tasks(session):
    return session.get("/api/tasks?is_completed=all").get_json()["tasks"]


def test_completing_a_repeating_task_records_it_and_moves_to_the_next_day(session, task_payload):
    task_id = create_daily_task(session, task_payload)

    assert complete(session, task_id).status_code == 200

    tasks = {t["id"]: t for t in all_tasks(session)}
    assert len(tasks) == 2
    assert tasks[task_id]["isCompleted"] is False
    assert tasks[task_id]["startAt"].startswith("2026-03-03T09:00")
    history = [t for t in tasks.values() if t["id"] != task_id][0]
    assert history["isCompleted"] is True
    assert history["startAt"].startswith("2026-03-02T09:00")


def test_completing_the_same_occurrence_twice_only_counts_once(session, task_payload):
    task_id = create_daily_task(session, task_payload)
    occurrence = "2026-03-02 09:00:00"

    assert complete(session, task_id, expectedStartAt=occurrence).status_code == 200
    again = complete(session, task_id, expectedStartAt=occurrence)

    assert again.status_code == 409
    assert len(all_tasks(session)) == 2


def test_end_time_is_checked_against_the_stored_start_time(session, task_payload):
    task_id = session.post("/api/tasks", json=task_payload()).get_json()["id"]

    response = session.patch(f"/api/tasks/{task_id}", json={"endAt": "2026-03-02 09:00:00"})

    assert response.status_code == 400
    assert "endAt" in response.get_json()["errors"]
