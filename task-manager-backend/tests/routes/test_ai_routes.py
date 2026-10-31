from collections.abc import Callable, Iterator
from unittest import mock

import pytest
from flask import Flask
from flask.testing import FlaskClient

import app.routes.ai_routes as ai_routes
from app import config


@pytest.fixture(autouse=True)
def fake_ai() -> Iterator[tuple[mock.MagicMock, mock.MagicMock]]:
    with (
        mock.patch.object(
            ai_routes, "parse_task_with_ai", return_value={"title": "Parsed"}
        ) as parse,
        mock.patch.object(
            ai_routes, "decompose_task", return_value=[{"title": "Step"}]
        ) as decompose,
    ):
        yield parse, decompose


@pytest.mark.parametrize("text", ["", "   ", "x" * 501, 5])
def test_parse_task_rejects_bad_text_without_calling_the_provider(
    session: FlaskClient, fake_ai: tuple[mock.MagicMock, mock.MagicMock], text: object
) -> None:
    response = session.post("/api/ai/parse-task", json={"text": text})
    assert response.status_code == 400
    fake_ai[0].assert_not_called()


def test_decompose_rejects_oversized_or_invalid_input(
    session: FlaskClient, fake_ai: tuple[mock.MagicMock, mock.MagicMock]
) -> None:
    for body in (
        {"title": ""},
        {"title": "x" * 256},
        {"title": "Plan", "description": "x" * 2001},
        {"title": "Plan", "category": "not-a-category"},
    ):
        assert session.post("/api/ai/decompose", json=body).status_code == 400
    fake_ai[1].assert_not_called()


def test_valid_requests_reach_the_provider(session: FlaskClient) -> None:
    assert (
        session.post("/api/ai/parse-task", json={"text": "Dentist at 3pm"}).status_code
        == 200
    )
    assert (
        session.post(
            "/api/ai/decompose", json={"title": "Plan trip", "category": "social"}
        ).status_code
        == 200
    )


def test_daily_limit_applies_per_user(
    app: Flask,
    make_user: Callable[..., int],
    login: Callable[..., FlaskClient],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "AI_DAILY_LIMIT", 2)
    make_user("a@example.com")
    make_user("b@example.com")
    a, b = login("a@example.com"), login("b@example.com")

    codes = [
        a.post("/api/ai/parse-task", json={"text": "Task"}).status_code
        for _ in range(3)
    ]
    assert codes == [200, 200, 429]
    assert b.post("/api/ai/parse-task", json={"text": "Task"}).status_code == 200


def test_demo_account_has_its_own_limit(
    client: FlaskClient,
    make_demo_user: Callable[[], int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "AI_DAILY_LIMIT", 1)
    monkeypatch.setattr(config, "AI_DAILY_LIMIT_DEMO", 2)
    make_demo_user()
    client.post("/api/auth/demo")

    codes = [
        client.post("/api/ai/parse-task", json={"text": "Task"}).status_code
        for _ in range(3)
    ]
    assert codes == [200, 200, 429]
