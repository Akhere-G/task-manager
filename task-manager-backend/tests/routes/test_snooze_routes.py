from datetime import timedelta
from typing import Any

import pytest
from flask.testing import FlaskClient

from app.utils.dates import utc_now

pytestmark = pytest.mark.integration


def add(session: FlaskClient, **extra: Any) -> dict:
    response = session.post("/api/tasks", json={"title": "Thing", **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def snooze(session: FlaskClient, task: dict, **body: Any) -> Any:
    return session.post(
        f"/api/tasks/{task['id']}/snooze", json={"zoneName": "UTC", **body}
    )


def today_at(hour: int) -> dict[str, str]:
    start = utc_now().replace(hour=hour, minute=0, second=0, microsecond=0)
    return {
        "startAt": start.isoformat(),
        "endAt": (start + timedelta(minutes=45)).isoformat(),
    }


def test_tomorrow_keeps_the_time_of_day_and_length(session: FlaskClient) -> None:
    task = add(session, **today_at(15))

    response = snooze(session, task, preset="tomorrow")

    moved = response.get_json()
    tomorrow = (utc_now() + timedelta(days=1)).date().isoformat()
    assert moved["startAt"] == f"{tomorrow}T15:00:00Z"
    assert moved["endAt"] == f"{tomorrow}T15:45:00Z"


def test_an_undated_task_is_given_nine_for_thirty_minutes(
    session: FlaskClient,
) -> None:
    task = add(session)

    moved = snooze(session, task, preset="tomorrow").get_json()

    tomorrow = (utc_now() + timedelta(days=1)).date().isoformat()
    assert moved["startAt"] == f"{tomorrow}T09:00:00Z"
    assert moved["endAt"] == f"{tomorrow}T09:30:00Z"


def test_a_chosen_date_is_used(session: FlaskClient) -> None:
    task = add(session, **today_at(10))

    moved = snooze(session, task, preset="date", day="2031-05-06").get_json()

    assert moved["startAt"] == "2031-05-06T10:00:00Z"


def test_snoozing_a_repeating_task_moves_only_that_occurrence(
    session: FlaskClient,
) -> None:
    task = add(session, repeatBy="daily", **today_at(8))

    moved = snooze(session, task, preset="next_week").get_json()

    assert moved["isRepeating"] is True
    assert moved["startAt"] > task["startAt"]


def test_next_occurrence_advances_a_repeating_task(session: FlaskClient) -> None:
    task = add(session, repeatBy="daily", **today_at(8))

    moved = snooze(session, task, preset="next_occurrence").get_json()

    tomorrow = (utc_now() + timedelta(days=1)).date().isoformat()
    assert moved["startAt"] == f"{tomorrow}T08:00:00Z"
    assert moved["isCompleted"] is False


def test_next_occurrence_is_refused_for_a_plain_task(session: FlaskClient) -> None:
    task = add(session, **today_at(8))

    assert snooze(session, task, preset="next_occurrence").status_code == 400


@pytest.mark.parametrize(
    "body",
    [
        {"preset": "someday"},
        {"preset": "date"},
        {"preset": "tomorrow", "zoneName": "Mars/Base"},
        {"preset": "tomorrow", "isGhost": True},
    ],
)
def test_bad_requests_are_rejected(session: FlaskClient, body: dict) -> None:
    task = add(session, **today_at(8))

    assert snooze(session, task, **body).status_code == 400
