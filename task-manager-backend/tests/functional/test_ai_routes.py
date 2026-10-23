from unittest import mock

import pytest

import app.routes.ai_routes as ai_routes
import app.services.ai_service as ai_service
from app import config


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


@pytest.fixture
def fake_ai():
    with mock.patch.object(ai_routes, "parse_task_with_ai", return_value={"title": "Parsed"}) as parse, \
         mock.patch.object(ai_routes, "decompose_task", return_value=[{"title": "Step"}]) as decompose:
        yield parse, decompose


def test_invalid_requests_are_rejected_before_reaching_the_provider(session, fake_ai):
    assert session.post("/api/ai/parse-task", json={"text": ""}).status_code == 400
    assert session.post("/api/ai/decompose", json={"title": ""}).status_code == 400
    fake_ai[0].assert_not_called()
    fake_ai[1].assert_not_called()


def test_valid_requests_return_the_provider_result(session, fake_ai):
    parsed = session.post("/api/ai/parse-task", json={"text": "Dentist at 3pm"})
    assert parsed.get_json() == {"title": "Parsed"}

    decomposed = session.post(
        "/api/ai/decompose",
        json={"title": "Plan trip", "category": "social", "startAt": "2026-03-02", "endAt": "2026-03-03"},
    )
    assert decomposed.get_json() == {"tasks": [{"title": "Step"}]}
    fake_ai[1].assert_called_once_with("Plan trip", "", "social", "2026-03-02", "2026-03-03")


def test_decompose_reports_when_nothing_usable_came_back(session, fake_ai):
    fake_ai[1].return_value = []
    assert session.post("/api/ai/decompose", json={"title": "Plan"}).status_code == 400


def test_daily_limit_applies_per_user(make_user, login, fake_ai, monkeypatch):
    monkeypatch.setattr(config, "AI_DAILY_LIMIT", 2)
    make_user("a@example.com")
    make_user("b@example.com")
    a, b = login("a@example.com"), login("b@example.com")

    codes = [a.post("/api/ai/parse-task", json={"text": "Task"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    assert b.post("/api/ai/parse-task", json={"text": "Task"}).status_code == 200


def test_demo_account_has_its_own_limit(client, make_demo_user, fake_ai, monkeypatch):
    monkeypatch.setattr(config, "AI_DAILY_LIMIT", 1)
    monkeypatch.setattr(config, "AI_DAILY_LIMIT_DEMO", 2)
    make_demo_user()
    client.post("/api/auth/demo")

    codes = [client.post("/api/ai/parse-task", json={"text": "Task"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_daily_brief_flags_a_fallback(session):
    with mock.patch.object(ai_service, "get_generated_text", side_effect=Exception("down")):
        data = session.get("/api/ai/daily-brief").get_json()
    assert data["fallback"] is True and data["success"] is True


def generated(text=None, error=None):
    return mock.patch.object(
        ai_service, "get_generated_text", return_value=text, side_effect=error
    )


VALID_TASK = (
    '{"title": "Dentist", "description": null, "category": "health", '
    '"startAt": "2026-03-02 15:00", "endAt": "2026-03-02 16:00", '
    '"isRepeating": false, "repeatBy": null, "repeatUntil": null}'
)


def test_quick_add_returns_a_valid_task_for_well_formed_output(session):
    with generated(VALID_TASK):
        response = session.post("/api/ai/parse-task", json={"text": "Dentist at 3pm"})

    task = response.get_json()
    assert response.status_code == 200
    assert task["category"] == "health" and task["title"]
    assert task["startAt"] < task["endAt"]


@pytest.mark.parametrize(
    "output",
    [
        "Sorry, I can't help with that.",
        "{not json",
        "[1, 2, 3]",
        '{"title": 42, "category": "work"}',
        "",
        None,
    ],
)
def test_quick_add_falls_back_to_a_usable_task_for_unusable_output(session, output):
    with generated(output):
        response = session.post("/api/ai/parse-task", json={"text": "Buy milk tomorrow"})

    task = response.get_json()
    assert response.status_code == 200
    assert task["title"] and task["category"] == "general"
    assert task["startAt"] < task["endAt"]


def test_quick_add_repairs_an_unknown_category(session):
    with generated(VALID_TASK.replace("health", "astrology")):
        task = session.post("/api/ai/parse-task", json={"text": "Dentist"}).get_json()

    assert task["category"] == "general"


@pytest.mark.xfail(
    strict=True,
    reason="parse_task_with_ai only catches ValueError/ValidationError, so a provider "
    "failure surfaces as a 500 (ai_service.py:204)",
)
def test_quick_add_survives_every_provider_failing(session):
    with generated(error=Exception("All AI providers failed.")):
        response = session.post("/api/ai/parse-task", json={"text": "Buy milk"})

    assert response.status_code == 200


def subtasks(count):
    item = (
        '{"title": "Step %d", "description": null, "category": "work", '
        '"startAt": "2026-03-02 09:00:00", "endAt": "2026-03-02 10:00:00"}'
    )
    return "[" + ",".join(item % n for n in range(count)) + "]"


def test_decompose_returns_valid_subtasks(session):
    with generated(subtasks(4)):
        response = session.post("/api/ai/decompose", json={"title": "Plan trip"})

    tasks = response.get_json()["tasks"]
    assert response.status_code == 200 and len(tasks) == 4
    assert all(t["title"] and t["startAt"] < t["endAt"] for t in tasks)


def test_decompose_caps_the_number_of_subtasks(session):
    with generated(subtasks(12)):
        tasks = session.post("/api/ai/decompose", json={"title": "Plan trip"}).get_json()["tasks"]

    assert 1 <= len(tasks) <= 7


def test_decompose_drops_invalid_items_but_keeps_the_valid_ones(session):
    mixed = '[{"title": ""}, {"nonsense": true}, ' + subtasks(1)[1:]
    with generated(mixed):
        response = session.post("/api/ai/decompose", json={"title": "Plan trip"})

    assert response.status_code == 200
    assert [t["title"] for t in response.get_json()["tasks"]] == ["Step 0"]


@pytest.mark.parametrize("output", ["Here are some ideas!", "{}", "[]", "[1, 2]", ""])
def test_decompose_reports_unusable_output_as_a_client_visible_error(session, output):
    with generated(output):
        response = session.post("/api/ai/decompose", json={"title": "Plan trip"})

    assert response.status_code == 400
    assert "tasks" not in response.get_json()


def test_decompose_reports_provider_failure_without_crashing(session):
    with generated(error=Exception("down")):
        response = session.post("/api/ai/decompose", json={"title": "Plan trip"})

    assert response.status_code == 400


def test_daily_brief_returns_the_generated_text_once_per_day(session):
    with generated("Start with the report.") as ai:
        first = session.get("/api/ai/daily-brief").get_json()
        second = session.get("/api/ai/daily-brief").get_json()

    assert first["success"] is True and first["fallback"] is False
    assert first["brief"] == second["brief"] == "Start with the report."
    assert ai.call_count == 1
