import pytest

WINDOW = {
    "start_date": "2026-03-01",
    "end_date": "2026-03-07",
    "project_repeating": "true",
    "is_completed": "all",
}


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


def create_series(session, task_payload, repeat_by="daily", **overrides):
    payload = task_payload(
        title="Standup",
        startAt="2026-03-02 09:00:00",
        endAt="2026-03-02 10:00:00",
        repeatBy=repeat_by,
        **overrides,
    )
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def calendar(session, **params):
    response = session.get("/api/tasks", query_string={**WINDOW, **params})
    assert response.status_code == 200, response.get_json()
    return response.get_json()["tasks"]


def starts(tasks):
    return sorted(t["startAt"] for t in tasks)


def test_creating_with_repeat_by_marks_the_task_as_repeating(session, task_payload):
    task_id = create_series(session, task_payload, "weekly")

    task = session.get(f"/api/tasks/{task_id}").get_json()

    assert task["isRepeating"] is True and task["repeatBy"] == "weekly"
    assert task["seriesId"] == task_id


def test_calendar_returns_the_head_and_ghosts_with_the_ghost_contract(session, task_payload):
    head_id = create_series(session, task_payload)

    tasks = calendar(session)

    real = [t for t in tasks if not t.get("isGhost")]
    ghosts = [t for t in tasks if t.get("isGhost")]
    assert [t["id"] for t in real] == [head_id]
    assert ghosts, "expected projected occurrences"
    for ghost in ghosts:
        assert ghost["seriesId"] == head_id
        assert isinstance(ghost["id"], str) and ghost["id"].startswith(f"ghost_{head_id}_")
        assert ghost["startAt"].endswith("Z")


def test_refetching_the_calendar_is_stable_and_nothing_is_persisted(session, task_payload):
    create_series(session, task_payload)

    first = calendar(session)
    second = calendar(session)
    stored = session.get("/api/tasks", query_string={"is_completed": "all"}).get_json()

    assert starts(first) == starts(second)
    assert len(stored["tasks"]) == 1


def test_ghost_ids_cannot_be_fetched_edited_or_deleted_directly(session, task_payload):
    head_id = create_series(session, task_payload)
    ghost_id = next(t["id"] for t in calendar(session) if t.get("isGhost"))

    responses = [
        session.get(f"/api/tasks/{ghost_id}"),
        session.patch(f"/api/tasks/{ghost_id}", json={"title": "Hijacked"}),
        session.delete(f"/api/tasks/{ghost_id}"),
    ]

    assert all(400 <= r.status_code < 500 for r in responses)
    assert session.get(f"/api/tasks/{head_id}").get_json()["title"] == "Standup"


def test_completing_the_head_then_refetching_has_no_duplicate_occurrences(
    session, task_payload
):
    head_id = create_series(session, task_payload)

    response = session.patch(
        f"/api/tasks/{head_id}",
        json={
            "isCompleted": True,
            "completedAt": "2026-03-02 09:30:00",
            "expectedStartAt": "2026-03-02 09:00:00",
        },
    )
    assert response.status_code == 200
    assert response.get_json()["startAt"] == "2026-03-03T09:00:00Z"

    series = [t for t in calendar(session) if t["seriesId"] == head_id]
    all_starts = starts(series)
    assert all_starts[0] == "2026-03-02T09:00:00Z"
    assert len(set(all_starts)) == len(all_starts)
    assert [t["startAt"] for t in series if t["isCompleted"]] == ["2026-03-02T09:00:00Z"]


def test_deleting_the_head_removes_every_projected_occurrence(session, task_payload):
    head_id = create_series(session, task_payload)
    assert any(t.get("isGhost") for t in calendar(session))

    assert session.delete(f"/api/tasks/{head_id}").status_code == 200

    assert calendar(session) == []


def test_projection_is_scoped_to_the_signed_in_user(make_user, login, task_payload):
    make_user("a@example.com")
    make_user("b@example.com")
    a, b = login("a@example.com"), login("b@example.com")
    create_series(a, task_payload)

    assert calendar(b) == []
    assert any(t.get("isGhost") for t in calendar(a))


@pytest.mark.parametrize(
    "params",
    [
        {"project_repeating": "true", "start_date": "2026-03-01", "end_date": "2027-06-01"},
        {"project_repeating": "true", "start_date": "2026-03-07", "end_date": "2026-03-01"},
        {"project_repeating": "true", "start_date": "not-a-date", "end_date": "2026-03-01"},
    ],
)
def test_invalid_projection_ranges_are_rejected(session, params):
    assert session.get("/api/tasks", query_string=params).status_code == 400


def test_a_repeating_task_needs_a_frequency(session, task_payload):
    response = session.post("/api/tasks", json=task_payload(isRepeating=True))

    assert response.status_code == 400
    assert "repeatBy" in response.get_json()["errors"]


def test_an_unknown_frequency_is_rejected(session, task_payload):
    response = session.post("/api/tasks", json=task_payload(repeatBy="hourly"))

    assert response.status_code == 400
    assert "repeatBy" in response.get_json()["errors"]
