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


def test_completing_without_a_timestamp_still_records_when(session, task_payload):
    task_id = session.post("/api/tasks", json=task_payload()).get_json()["id"]

    done = session.patch(f"/api/tasks/{task_id}", json={"isCompleted": True}).get_json()
    assert done["isCompleted"] is True and done["completedAt"].endswith("Z")

    undone = session.patch(f"/api/tasks/{task_id}", json={"isCompleted": False}).get_json()
    assert undone["completedAt"] is None


def test_bulk_import_fixes_completion_and_repeat_flags(session, task_payload):
    response = session.post(
        "/api/tasks/bulk",
        json=[
            task_payload(isCompleted=True),
            task_payload(completedAt="2026-03-02 10:30:00"),
            task_payload(repeatBy="weekly"),
        ],
    )
    assert response.status_code == 201

    by_completion = {t["isCompleted"]: t for t in all_tasks(session)}
    assert by_completion[True]["completedAt"] is not None
    assert by_completion[False]["completedAt"] is None
    assert any(t["isRepeating"] for t in all_tasks(session))


def test_bulk_validation_errors_are_listed_per_task(session, task_payload):
    response = session.post(
        "/api/tasks/bulk", json=[task_payload(), task_payload(category="nope", title="")]
    )

    assert response.status_code == 400
    errors = response.get_json()["errors"]
    assert errors[0] == {} and set(errors[1]) == {"title", "category"}


def test_create_returns_the_stored_task(session, task_payload):
    created = session.post("/api/tasks", json=task_payload(title="  Trim me  ")).get_json()

    assert created["title"] == "Trim me"
    assert created["startAt"] == "2026-03-02T10:00:00Z"
    assert created["seriesId"] == created["id"]


def test_list_filters_are_validated(session):
    for query in ("page=0", "limit=500", "start_date=2026-03-01", "project_repeating=true"):
        assert session.get(f"/api/tasks?{query}").status_code == 400
    ok = session.get("/api/tasks?start_date=2026-03-01&end_date=2026-03-31&project_repeating=true")
    assert ok.status_code == 200


def test_missing_task_is_a_404(session):
    assert session.get("/api/tasks/999").status_code == 404
    assert session.patch("/api/tasks/999", json={"title": "x"}).status_code == 404
    assert session.delete("/api/tasks/999").status_code == 404


def test_projecting_a_repeating_task_adds_ghost_occurrences(session, task_payload):
    task_id = create_daily_task(session, task_payload)

    response = session.get(
        "/api/tasks?start_date=2026-03-03&end_date=2026-03-05T23:59:59&project_repeating=true"
    )

    tasks = response.get_json()["tasks"]
    ghosts = [t for t in tasks if t.get("isGhost")]
    assert [g["startAt"][:10] for g in ghosts] == ["2026-03-03", "2026-03-04", "2026-03-05"]
    assert {g["seriesId"] for g in ghosts} == {task_id}
    assert all(g["id"].startswith(f"ghost_{task_id}_") for g in ghosts)
