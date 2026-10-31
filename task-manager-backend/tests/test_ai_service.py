import json
from typing import Any
from unittest import mock

import pytest

from app.exceptions import AIUnavailable
from app.services import ai_service
from app.services.ai_service import _extract_json, decompose_task, parse_task_with_ai


def reply(payload: Any, fenced: bool = False) -> str:
    text = json.dumps(payload)
    return f"```json\n{text}\n```" if fenced else text


@pytest.mark.parametrize(
    "raw", ['{"a": 1}', '```json\n{"a": 1}\n```', '```\n{"a": 1}\n```']
)
def test_extract_json_handles_code_fences(raw: str) -> None:
    assert _extract_json(raw) == {"a": 1}


def test_parse_repairs_what_the_model_got_wrong() -> None:
    model = {
        "title": "Gym",
        "category": "not-real",
        "startAt": "2026-03-02 07:00",
        "endAt": "",
        "repeatBy": "weekly",
        "repeatInterval": 999,
        "repeatDays": [0, 9, "x", 3],
        "repeatUntil": "soon",
    }
    with mock.patch.object(
        ai_service, "get_generated_text", return_value=reply(model, fenced=True)
    ):
        task = parse_task_with_ai("gym on mon and thu")

    assert task["category"] == "general"
    assert task["startAt"] == "2026-03-02 07:00" and task["endAt"].endswith("23:59:59")
    assert (task["isRepeating"], task["repeatBy"], task["repeatInterval"]) == (
        True,
        "weekly",
        52,
    )
    assert task["repeatDays"] == [0, 3] and task["repeatUntil"] is None


def test_parse_clears_recurrence_when_the_frequency_is_unknown() -> None:
    model = {"title": "Once", "repeatBy": "fortnightly", "repeatDays": [1]}
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(model)):
        task = parse_task_with_ai("once")

    assert (
        task["isRepeating"] is False
        and task["repeatBy"] is None
        and task["repeatDays"] is None
    )


@pytest.mark.parametrize(
    "bad_reply", ["not json", "[]", '{"description": "no title"}', ""]
)
def test_parse_falls_back_to_the_raw_text(bad_reply: str) -> None:
    with mock.patch.object(ai_service, "get_generated_text", return_value=bad_reply):
        task = parse_task_with_ai("Call the dentist")

    assert task["title"] == "Call the dentist" and task["category"] == "general"


def test_parse_surfaces_provider_outage() -> None:
    with mock.patch.object(
        ai_service, "get_generated_text", side_effect=AIUnavailable()
    ):
        with pytest.raises(AIUnavailable):
            parse_task_with_ai("anything")


def test_decompose_returns_valid_steps_and_empty_list_otherwise() -> None:
    steps = [
        {"title": "Book flights", "category": "social"},
        {"title": "Pack", "category": "oops"},
    ]
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(steps)):
        result = decompose_task("Trip", "", "social", "", "")
    assert [t["title"] for t in result] == ["Book flights", "Pack"]
    assert result[1]["category"] == "general"

    for bad in (
        "nope",
        '{"title": "not a list"}',
        reply([{"description": "no title"}]),
    ):
        with mock.patch.object(ai_service, "get_generated_text", return_value=bad):
            assert decompose_task("Trip", "", "", "", "") == []

    with mock.patch.object(
        ai_service, "get_generated_text", side_effect=AIUnavailable()
    ):
        assert decompose_task("Trip", "", "", "", "") == []


def test_generation_falls_back_to_groq_when_gemini_is_empty() -> None:
    with (
        mock.patch.object(ai_service, "_ask_gemini", return_value=""),
        mock.patch.object(ai_service, "_ask_groq", return_value="from groq"),
    ):
        assert ai_service.get_generated_text("hi") == "from groq"

    with (
        mock.patch.object(ai_service, "_ask_gemini", side_effect=RuntimeError),
        mock.patch.object(ai_service, "_ask_groq", side_effect=RuntimeError),
    ):
        with pytest.raises(AIUnavailable):
            ai_service.get_generated_text("hi")
