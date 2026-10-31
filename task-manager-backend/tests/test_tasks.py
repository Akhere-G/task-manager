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


def create_task(session, task_payload, **overrides):
    response = session.post(
        "/api/tasks",
        json=task_payload(startAt="2026-03-02 09:00:00", endAt="2026-03-02 10:00:00", **overrides),
    )
    assert response.status_code == 201
    return response.get_json()


def reschedule(session, task_id, previous, new, is_ghost):
    return session.post(
        f"/api/tasks/{task_id}/reschedule",
        json={
            "previousStartAt": previous[0],
            "previousEndAt": previous[1],
            "startAt": new[0],
            "endAt": new[1],
            "isGhost": is_ghost,
        },
    )


def ghost_starts(session, start_date, end_date):
    tasks = session.get(
        f"/api/tasks?start_date={start_date}&end_date={end_date}T23:59:59&project_repeating=true"
    ).get_json()["tasks"]
    return [t["startAt"] for t in tasks if t.get("isGhost")]


MONDAY = ("2026-03-02 09:00:00", "2026-03-02 10:00:00")
NEXT_MONDAY = ("2026-03-09 09:00:00", "2026-03-09 10:00:00")


def test_rescheduling_a_one_off_task_sets_the_new_times(session, task_payload):
    task = create_task(session, task_payload)

    moved = reschedule(
        session, task["id"], MONDAY, ("2026-03-04 15:00:00", "2026-03-04 17:00:00"), False
    ).get_json()

    assert moved["startAt"] == "2026-03-04T15:00:00Z"
    assert moved["endAt"] == "2026-03-04T17:00:00Z"


def test_moving_a_daily_ghost_offsets_the_whole_series(session, task_payload):
    task = create_task(session, task_payload, repeatBy="daily")

    moved = reschedule(
        session,
        task["id"],
        ("2026-03-04 09:00:00", "2026-03-04 10:00:00"),
        ("2026-03-04 11:00:00", "2026-03-04 12:30:00"),
        True,
    ).get_json()

    assert moved["startAt"] == "2026-03-02T11:00:00Z"
    assert moved["endAt"] == "2026-03-02T12:30:00Z"
    assert ghost_starts(session, "2026-03-03", "2026-03-03") == ["2026-03-03T11:00:00Z"]


def test_moving_a_weekly_task_to_another_day_does_not_jump_a_week(session, task_payload):
    task = create_task(session, task_payload, repeatBy="weekly")

    moved = reschedule(
        session, task["id"], MONDAY, ("2026-03-03 09:00:00", "2026-03-03 10:00:00"), False
    ).get_json()

    assert moved["startAt"] == "2026-03-03T09:00:00Z"
    assert moved["repeatDays"] == [1]


def test_moving_a_weekly_ghost_swaps_its_day(session, task_payload):
    task = create_task(session, task_payload, repeatBy="weekly")

    moved = reschedule(
        session, task["id"], NEXT_MONDAY, ("2026-03-10 09:00:00", "2026-03-10 10:00:00"), True
    ).get_json()

    assert moved["repeatDays"] == [1]
    assert moved["startAt"] == "2026-03-03T09:00:00Z"
    assert ghost_starts(session, "2026-03-09", "2026-03-15") == ["2026-03-10T09:00:00Z"]


def test_moving_a_ghost_onto_a_day_already_chosen_merges_them(session, task_payload):
    task = create_task(session, task_payload, repeatBy="weekly", repeatDays=[0, 2])

    moved = reschedule(
        session, task["id"], NEXT_MONDAY, ("2026-03-11 09:00:00", "2026-03-11 10:00:00"), True
    ).get_json()

    assert moved["repeatDays"] == [2]


def test_moving_a_ghost_to_another_time_moves_the_series_time(session, task_payload):
    task = create_task(session, task_payload, repeatBy="weekly")

    moved = reschedule(
        session, task["id"], NEXT_MONDAY, ("2026-03-10 14:00:00", "2026-03-10 14:30:00"), True
    ).get_json()

    assert moved["startAt"] == "2026-03-03T14:00:00Z"
    assert moved["endAt"] == "2026-03-03T14:30:00Z"
    assert ghost_starts(session, "2026-03-09", "2026-03-15") == ["2026-03-10T14:00:00Z"]


def test_moving_a_clamped_monthly_ghost_replaces_the_day_it_stands_for(session, task_payload):
    task = session.post(
        "/api/tasks",
        json=task_payload(
            startAt="2026-01-31 09:00:00",
            endAt="2026-01-31 10:00:00",
            repeatBy="monthly",
            repeatDays=[31],
        ),
    ).get_json()

    moved = reschedule(
        session,
        task["id"],
        ("2026-02-28 09:00:00", "2026-02-28 10:00:00"),
        ("2026-02-15 09:00:00", "2026-02-15 10:00:00"),
        True,
    ).get_json()

    assert moved["repeatDays"] == [15]
    assert moved["startAt"] == "2026-02-15T09:00:00Z"


def test_rescheduling_a_stale_occurrence_is_a_conflict(session, task_payload):
    task = create_task(session, task_payload, repeatBy="weekly")

    response = reschedule(
        session, task["id"], NEXT_MONDAY, ("2026-03-10 09:00:00", "2026-03-10 10:00:00"), False
    )

    assert response.status_code == 409


def test_reschedule_payload_is_validated(session, task_payload):
    task = create_task(session, task_payload)

    backwards = reschedule(session, task["id"], MONDAY, (MONDAY[1], MONDAY[0]), False)
    missing = session.post(f"/api/tasks/{task['id']}/reschedule", json={"startAt": MONDAY[0]})

    assert backwards.status_code == 400
    assert "endAt" in backwards.get_json()["errors"]
    assert missing.status_code == 400
    assert reschedule(session, 999, MONDAY, MONDAY, False).status_code == 404
