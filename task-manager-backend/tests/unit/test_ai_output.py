import json
from unittest import mock

import pytest

from app.services import ai_service


def generated(output):
    return mock.patch.object(ai_service, "get_generated_text", return_value=output)


GOOD = {
    "title": "Dentist",
    "description": None,
    "category": "health",
    "startAt": "2026-03-02 15:00",
    "endAt": "2026-03-02 16:00",
    "isRepeating": False,
    "repeatBy": None,
    "repeatUntil": None,
}


def test_valid_output_is_returned_whatever_the_markdown_wrapping():
    with generated("```json\n" + json.dumps(GOOD) + "\n```"):
        task = ai_service.parse_task_with_ai("Dentist at 3pm")
    assert task["title"] == "Dentist" and task["category"] == "health"


def test_unknown_category_becomes_general_and_missing_times_are_filled():
    with generated(json.dumps({"title": "Misc", "category": "weird"})):
        task = ai_service.parse_task_with_ai("Misc")
    assert task["category"] == "general"
    assert task["startAt"].endswith("00:00:00") and task["endAt"].endswith("23:59:59")


@pytest.mark.parametrize("output", ["not json", "[]", '{"category": "work"}', ""])
def test_unusable_output_falls_back_to_the_user_text(output):
    with generated(output):
        task = ai_service.parse_task_with_ai("Call mum tomorrow")
    assert task["title"] == "Call mum tomorrow"
    assert task["category"] == "general"


def test_subtasks_keep_only_valid_items():
    items = [GOOD, {"description": "no title"}, "nonsense", {**GOOD, "title": "Second"}]
    with generated(json.dumps(items)):
        subtasks = ai_service.decompose_task("Plan", "", "work", "", "")
    assert [t["title"] for t in subtasks] == ["Dentist", "Second"]


@pytest.mark.parametrize("output", ["oops", '{"title": "x"}', ""])
def test_unusable_subtask_output_gives_an_empty_list(output):
    with generated(output):
        assert ai_service.decompose_task("Plan", "", "work", "", "") == []


def test_provider_failure_gives_an_empty_list():
    with mock.patch.object(ai_service, "get_generated_text", side_effect=Exception("down")):
        assert ai_service.decompose_task("Plan", "", "work", "", "") == []
