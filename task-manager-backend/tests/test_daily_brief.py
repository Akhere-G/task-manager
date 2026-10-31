from collections.abc import Callable
from datetime import datetime
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from flask import Flask
from flask.testing import FlaskClient

import app.services.ai_service as ai_service
from app.database import db
from app.models import DailyBrief
from tests.conftest import _connection


@pytest.fixture
def session(
    make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> FlaskClient:
    make_user()
    return login()


def stored_briefs(app: Flask) -> list[DailyBrief]:
    with app.app_context():
        return db.session.query(DailyBrief).all()


def test_second_provider_is_used_when_the_first_fails() -> None:
    with (
        mock.patch.object(ai_service.genai, "Client", side_effect=RuntimeError("down")),
        mock.patch.object(ai_service, "Groq") as groq,
    ):
        groq.return_value.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content="From Groq"))
        ]
        assert ai_service.get_generated_text("hello") == "From Groq"


def test_brief_is_flagged_as_fallback_and_not_stored_when_all_providers_fail(
    app: Flask, session: FlaskClient
) -> None:
    with mock.patch.object(
        ai_service, "get_generated_text", side_effect=Exception("down")
    ):
        data = session.get("/api/ai/daily-brief").get_json()

    assert data["fallback"] is True
    assert stored_briefs(app) == []


def test_brief_is_generated_once_per_day(app: Flask, session: FlaskClient) -> None:
    with mock.patch.object(
        ai_service, "get_generated_text", return_value="Hello!"
    ) as generate:
        first = session.get("/api/ai/daily-brief").get_json()
        second = session.get("/api/ai/daily-brief").get_json()

    assert first["brief"] == second["brief"] == "Hello!"
    assert first["fallback"] is False
    assert generate.call_count == 1


def test_brief_created_by_a_parallel_request_is_returned_instead_of_an_error(
    app: Flask, session: FlaskClient
) -> None:
    def generate_while_another_request_wins(prompt: str) -> str:
        import os

        conn = _connection()
        with conn.cursor() as cur:
            cur.execute(f"USE `{os.environ['DB_NAME']}`")
            cur.execute(
                "INSERT INTO daily_briefs (user_id, brief_text, generated_date) "
                "SELECT id, 'Winner', %s FROM users LIMIT 1",
                (ai_service.local_today(None),),
            )
        conn.close()
        return "Loser"

    with mock.patch.object(
        ai_service,
        "get_generated_text",
        side_effect=generate_while_another_request_wins,
    ):
        data = session.get("/api/ai/daily-brief").get_json()

    assert data["brief"] == "Winner"
    assert data["fallback"] is False


def test_brief_day_follows_the_users_timezone(app: Flask, session: FlaskClient) -> None:
    zone = "Pacific/Kiritimati"
    with mock.patch.object(ai_service, "get_generated_text", return_value="Hello!"):
        session.get("/api/ai/daily-brief", query_string={"tz": zone})

    assert stored_briefs(app)[0].generated_date == datetime.now(ZoneInfo(zone)).date()
