import pytest


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


@pytest.mark.parametrize(
    "query",
    [
        "page=abc",
        "page=0",
        "limit=0",
        "limit=1000",
        "start_date=banana&end_date=2026-01-01",
        "start_date=2026-01-01",
        "start_date=2026-02-01&end_date=2026-01-01",
        "project_repeating=true",
        "project_repeating=true&start_date=2000-01-01&end_date=2100-01-01",
    ],
)
def test_bad_parameters_return_400(session, query):
    response = session.get(f"/api/tasks?{query}")
    assert response.status_code == 400
    assert "errors" in response.get_json()


def test_valid_parameters_accepted(session):
    response = session.get(
        "/api/tasks?limit=200&page=1&project_repeating=true"
        "&start_date=2026-03-01T00:00:00.000Z&end_date=2026-04-12T23:59:59.999Z"
    )
    assert response.status_code == 200


def test_pages_cover_every_task_once(session, task_payload):
    for n in range(7):
        assert session.post("/api/tasks", json=task_payload(title=f"Task {n}")).status_code == 201

    seen = []
    for page in (1, 2, 3):
        data = session.get(f"/api/tasks?limit=3&page={page}&sort_by=start_at").get_json()
        seen += [t["id"] for t in data["tasks"]]
    assert len(seen) == 7
    assert len(set(seen)) == 7


def test_ghost_projection_returns_repeats_in_range(session, task_payload):
    created = session.post(
        "/api/tasks",
        json=task_payload(
            startAt="2026-03-01 09:00:00",
            endAt="2026-03-01 10:00:00",
            repeatBy="daily",
        ),
    )
    assert created.status_code == 201
    data = session.get(
        "/api/tasks?project_repeating=true"
        "&start_date=2026-03-01T00:00:00.000Z&end_date=2026-03-05T23:59:59.999Z"
    ).get_json()
    ghosts = [t for t in data["tasks"] if t.get("isGhost")]
    assert len(ghosts) == 4
