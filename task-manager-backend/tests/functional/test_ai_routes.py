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
