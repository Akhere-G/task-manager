from datetime import timedelta
from typing import Any

import pytest
from flask.testing import FlaskClient

from app.utils.dates import utc_now

pytestmark = pytest.mark.integration


def dates(hours: int = 48) -> dict[str, str]:
    start = (utc_now() + timedelta(hours=hours)).replace(microsecond=0)
    return {
        "startAt": start.isoformat(),
        "endAt": (start + timedelta(hours=1)).isoformat(),
    }


def add(session: FlaskClient, **extra: Any) -> dict:
    response = session.post("/api/tasks", json={"title": "Thing", **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


BEFORE_HOUR = {"kind": "before", "minutesBefore": 60}
AT_NINE = {"kind": "clock", "daysBefore": 0, "timeOfDay": "09:00", "zoneName": "UTC"}


def test_a_dated_task_gets_a_default_reminder_30_minutes_before(
    session: FlaskClient,
) -> None:
    task = add(session, **dates())

    assert task["reminders"] == [
        {
            "kind": "before",
            "minutesBefore": 30,
            "daysBefore": None,
            "timeOfDay": None,
            "zoneName": None,
        }
    ]


def test_an_undated_task_gets_no_default_reminder(session: FlaskClient) -> None:
    assert add(session)["reminders"] == []


def test_a_subtask_gets_no_default_reminder(session: FlaskClient) -> None:
    parent = add(session, **dates())

    response = session.post(
        f"/api/tasks/{parent['id']}/subtasks", json={"subtasks": [{"title": "Part"}]}
    )

    assert response.status_code == 201
    child = session.get(f"/api/tasks/{parent['id']}").get_json()["subtasks"][0]
    assert "reminders" not in child or child["reminders"] == []


def test_reminders_given_on_create_replace_the_default(session: FlaskClient) -> None:
    task = add(session, reminders=[BEFORE_HOUR, AT_NINE], **dates())

    assert [r["kind"] for r in task["reminders"]] == ["before", "clock"]


def test_patching_reminders_replaces_the_set(session: FlaskClient) -> None:
    task = add(session, **dates())

    patched = session.patch(
        f"/api/tasks/{task['id']}", json={"reminders": [AT_NINE]}
    ).get_json()

    assert [r["kind"] for r in patched["reminders"]] == ["clock"]
    assert (
        session.get(f"/api/tasks/{task['id']}").get_json()["reminders"]
        == (patched["reminders"])
    )


def test_patching_without_reminders_keeps_them(session: FlaskClient) -> None:
    task = add(session, reminders=[BEFORE_HOUR], **dates())

    patched = session.patch(f"/api/tasks/{task['id']}", json={"title": "New"})

    assert patched.get_json()["reminders"][0]["minutesBefore"] == 60


@pytest.mark.parametrize(
    "reminder",
    [
        {"kind": "soon"},
        {"kind": "before"},
        {"kind": "clock", "daysBefore": 0},
        {"kind": "before", "minutesBefore": -5},
        {"kind": "clock", "timeOfDay": "09:00", "zoneName": "Mars/Base"},
    ],
)
def test_bad_reminders_are_rejected(session: FlaskClient, reminder: dict) -> None:
    response = session.post(
        "/api/tasks", json={"title": "Thing", "reminders": [reminder], **dates()}
    )

    assert response.status_code == 400


def test_a_task_can_be_saved_with_the_reminders_it_returned(
    session: FlaskClient,
) -> None:
    task = add(session, **dates())

    response = session.patch(
        f"/api/tasks/{task['id']}", json={"reminders": task["reminders"]}
    )

    assert response.status_code == 200
    assert response.get_json()["reminders"] == task["reminders"]
