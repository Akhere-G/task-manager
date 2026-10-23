import pytest


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


def create(session, payload):
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def list_titles(session, **params):
    response = session.get("/api/tasks", query_string=params)
    assert response.status_code == 200, response.get_json()
    return sorted(t["title"] for t in response.get_json()["tasks"])


def test_task_lifecycle(session, task_payload):
    task_id = create(session, task_payload())

    fetched = session.get(f"/api/tasks/{task_id}").get_json()
    assert fetched["title"] == "Write report"

    updated = session.patch(f"/api/tasks/{task_id}", json={"title": "Renamed"})
    assert updated.status_code == 200
    assert session.get(f"/api/tasks/{task_id}").get_json()["title"] == "Renamed"

    assert session.delete(f"/api/tasks/{task_id}").status_code == 200
    assert session.get(f"/api/tasks/{task_id}").status_code == 404
    assert session.patch(f"/api/tasks/{task_id}", json={"title": "x"}).status_code == 404


def test_invalid_task_returns_errors_by_field(session, task_payload):
    response = session.post(
        "/api/tasks", json=task_payload(title="", endAt="2026-03-02 09:00:00")
    )
    assert response.status_code == 400
    errors = response.get_json()["errors"]
    assert errors["title"] == "Title is mandatory."
    assert errors["endAt"] == "End time must be after the start time."


def test_end_time_is_checked_against_the_stored_start_time(session, task_payload):
    task_id = create(session, task_payload())
    response = session.patch(f"/api/tasks/{task_id}", json={"endAt": "2026-03-02 09:00:00"})
    assert response.status_code == 400
    assert "endAt" in response.get_json()["errors"]


def test_bulk_create_and_per_item_errors(session, task_payload):
    ok = session.post("/api/tasks/bulk", json=[task_payload(title="A"), task_payload(title="B")])
    assert ok.status_code == 201 and ok.get_json()["tasks_created"] == 2

    bad = session.post("/api/tasks/bulk", json=[task_payload(), task_payload(category="nope")])
    assert bad.status_code == 400
    errors = bad.get_json()["errors"]
    assert errors[0] == {} and "category" in errors[1]


def test_list_filters_search_and_paging(session, task_payload):
    create(session, task_payload(title="Quarterly budget report", category="work"))
    create(session, task_payload(title="Go gym", category="health"))
    create(session, task_payload(title="Plan holiday", category="social"))

    assert list_titles(session, category="health") == ["Go gym"]
    assert list_titles(session, q="budg") == ["Quarterly budget report"]
    assert list_titles(session, q="go") == ["Go gym"]
    assert list_titles(session, q='foo (bar "+-') == []

    page = session.get("/api/tasks", query_string={"limit": 2, "page": 2}).get_json()
    assert len(page["tasks"]) == 1 and page["totalPages"] == 2


@pytest.mark.parametrize(
    "params",
    [{"page": "0"}, {"limit": "1000"}, {"start_date": "2026-03-01"}, {"project_repeating": "true"}],
)
def test_invalid_list_parameters_are_rejected(session, params):
    assert session.get("/api/tasks", query_string=params).status_code == 400


def test_completing_the_same_occurrence_twice_returns_a_conflict(session, task_payload):
    task_id = create(
        session,
        task_payload(startAt="2026-03-02 09:00:00", endAt="2026-03-02 10:00:00", repeatBy="daily"),
    )
    complete = {"isCompleted": True, "completedAt": "2026-03-02 10:30:00",
                "expectedStartAt": "2026-03-02 09:00:00"}

    assert session.patch(f"/api/tasks/{task_id}", json=complete).status_code == 200
    again = session.patch(f"/api/tasks/{task_id}", json=complete)

    assert again.status_code == 409
    assert len(session.get("/api/tasks?is_completed=all").get_json()["tasks"]) == 2
