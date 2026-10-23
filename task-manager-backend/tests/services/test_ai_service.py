import os
from datetime import datetime
from unittest import mock
from zoneinfo import ZoneInfo

import pytest

from app.database import db
from app.models import DailyBrief
from app.services import ai_service
from tests.conftest import _connection


@pytest.fixture
def user_id(app, make_user):
    with app.app_context():
        user_id = make_user()
        yield user_id


def generate(text):
    return mock.patch.object(ai_service, "get_generated_text", return_value=text)


def test_second_provider_is_used_when_the_first_fails():
    with mock.patch.object(ai_service.genai, "Client", side_effect=RuntimeError("down")), \
         mock.patch.object(ai_service, "Groq") as groq:
        groq.return_value.chat.completions.create.return_value.choices = [
            mock.Mock(message=mock.Mock(content="From Groq"))
        ]
        assert ai_service.get_generated_text("hello") == "From Groq"


def test_brief_is_generated_once_per_day(user_id):
    with generate("Hello!") as provider:
        first = ai_service.generate_daily_brief(user_id)
        second = ai_service.generate_daily_brief(user_id)

    assert first == second == ("Hello!", False)
    assert provider.call_count == 1


def test_brief_falls_back_and_is_not_stored_when_every_provider_fails(user_id):
    with mock.patch.object(ai_service, "get_generated_text", side_effect=Exception("down")):
        text, is_fallback = ai_service.generate_daily_brief(user_id)

    assert is_fallback is True and text == ai_service.FALLBACK_BRIEF
    assert db.session.query(DailyBrief).count() == 0


def test_brief_written_by_a_parallel_request_is_returned_instead_of_an_error(user_id):
    def another_request_wins(prompt):
        conn = _connection()
        with conn.cursor() as cur:
            cur.execute(f"USE `{os.environ['DB_NAME']}`")
            cur.execute(
                "INSERT INTO daily_briefs (user_id, brief_text, generated_date) VALUES (%s, 'Winner', %s)",
                (user_id, ai_service.local_today(None)),
            )
        conn.close()
        return "Loser"

    with mock.patch.object(ai_service, "get_generated_text", side_effect=another_request_wins):
        assert ai_service.generate_daily_brief(user_id) == ("Winner", False)


def test_brief_day_follows_the_users_time_zone(user_id):
    zone = "Pacific/Kiritimati"
    with generate("Hello!"):
        ai_service.generate_daily_brief(user_id, zone)

    assert db.session.query(DailyBrief).one().generated_date == datetime.now(ZoneInfo(zone)).date()


def test_unknown_time_zone_falls_back_to_utc():
    assert ai_service.local_today("Not/AZone") == ai_service.local_today(None)
