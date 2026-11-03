import json
from collections.abc import Callable
from typing import Any
from unittest import mock

import pytest

from app.database import db
from app.exceptions import AIUnavailable
from app.models import Project
from app.services import ai_service
from app.services.ai_service import decompose_task, parse_task_with_ai


def reply(payload: Any, fenced: bool = False) -> str:
    text = json.dumps(payload)
    return f"```json\n{text}\n```" if fenced else text


GYM = {
    "title": "Gym",
    "project": "Health",
    "startAt": "2026-03-02 07:00",
    "endAt": "2026-03-02 08:00",
}


@pytest.mark.parametrize(
    "wrap",
    [
        lambda text: text,
        lambda text: f"```json\n{text}\n```",
        lambda text: f"```\n{text}\n```",
    ],
)
def test_parse_reads_json_with_or_without_code_fences(
    wrap: Callable[[str], str], user_id: int
) -> None:
    with mock.patch.object(
        ai_service, "get_generated_text", return_value=wrap(json.dumps(GYM))
    ):
        task = parse_task_with_ai(user_id, "gym session tomorrow morning")

    assert task["title"] == "Gym"


def test_parse_repairs_what_the_model_got_wrong(user_id: int) -> None:
    model = {
        "title": "Gym",
        "project": "not-real",
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
        task = parse_task_with_ai(user_id, "gym on mon and thu")

    assert task["projectId"] is None
    assert task["startAt"] == "2026-03-02 07:00" and task["endAt"].endswith("23:59:59")
    assert (task["isRepeating"], task["repeatBy"], task["repeatInterval"]) == (
        True,
        "weekly",
        52,
    )
    assert task["repeatDays"] == [0, 3] and task["repeatUntil"] is None


@pytest.mark.parametrize(
    "priority, expected", [(1, 1), (3, 3), (0, 4), ("p1", 4), (None, 4)]
)
def test_parse_keeps_a_valid_priority_and_defaults_the_rest(
    priority: Any, expected: int, user_id: int
) -> None:
    model = {**GYM, "priority": priority}
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(model)):
        task = parse_task_with_ai(user_id, "urgent gym session")

    assert task["priority"] == expected


def test_parse_clears_recurrence_when_the_frequency_is_unknown(user_id: int) -> None:
    model = {"title": "Once", "repeatBy": "fortnightly", "repeatDays": [1]}
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(model)):
        task = parse_task_with_ai(user_id, "once")

    assert (
        task["isRepeating"] is False
        and task["repeatBy"] is None
        and task["repeatDays"] is None
    )


@pytest.mark.parametrize(
    "bad_reply", ["not json", "[]", '{"description": "no title"}', ""]
)
def test_parse_falls_back_to_the_raw_text(bad_reply: str, user_id: int) -> None:
    with mock.patch.object(ai_service, "get_generated_text", return_value=bad_reply):
        task = parse_task_with_ai(user_id, "Call the dentist")

    assert task["title"] == "Call the dentist" and task["projectId"] is None
    assert task["priority"] == 4


def test_parse_surfaces_provider_outage(user_id: int) -> None:
    with (
        mock.patch.object(
            ai_service, "get_generated_text", side_effect=AIUnavailable()
        ),
        pytest.raises(AIUnavailable),
    ):
        parse_task_with_ai(user_id, "anything")


def test_decompose_returns_valid_steps_and_empty_list_otherwise() -> None:
    steps = [
        {"title": "Book flights", "project": "Social"},
        {"title": "Pack", "project": 5},
    ]
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(steps)):
        result = decompose_task("Trip", "", "", "")
    assert [t["title"] for t in result] == ["Book flights", "Pack"]
    assert all("project" not in t and "projectId" not in t for t in result)

    for bad in (
        "nope",
        '{"title": "not a list"}',
        reply([{"description": "no title"}]),
    ):
        with mock.patch.object(ai_service, "get_generated_text", return_value=bad):
            assert decompose_task("Trip", "", "", "") == []

    with mock.patch.object(
        ai_service, "get_generated_text", side_effect=AIUnavailable()
    ):
        assert decompose_task("Trip", "", "", "") == []


def test_decompose_tells_the_model_about_existing_subtasks_and_drops_repeats() -> None:
    steps = [{"title": "Book flights"}, {"title": "pack "}]
    with mock.patch.object(
        ai_service, "get_generated_text", return_value=reply(steps)
    ) as generate:
        result = decompose_task("Trip", "", "", "", ["Pack"])

    assert [t["title"] for t in result] == ["Book flights"]
    assert "- Pack" in generate.call_args.args[0]


def test_generation_falls_back_to_groq_when_gemini_is_empty() -> None:
    with (
        mock.patch.object(ai_service, "_ask_gemini", return_value=""),
        mock.patch.object(ai_service, "_ask_groq", return_value="from groq"),
    ):
        assert ai_service.get_generated_text("hi") == "from groq"


def test_generation_is_unavailable_when_every_provider_fails() -> None:
    with (
        mock.patch.object(ai_service, "_ask_gemini", side_effect=RuntimeError),
        mock.patch.object(ai_service, "_ask_groq", side_effect=RuntimeError),
        pytest.raises(AIUnavailable),
    ):
        ai_service.get_generated_text("hi")


def add_project(user_id: int, name: str, parent_id: int | None = None) -> int:
    project = Project(user_id=user_id, name=name, parent_id=parent_id)
    db.session.add(project)
    db.session.commit()
    return project.id


def parse_with_project(user_id: int, name: object) -> dict[str, Any]:
    model = {**GYM, "project": name}
    with mock.patch.object(ai_service, "get_generated_text", return_value=reply(model)):
        return parse_task_with_ai(user_id, "gym")


def test_parse_maps_the_models_project_name_to_the_users_project(
    user_id: int,
) -> None:
    health = add_project(user_id, "Health")

    assert parse_with_project(user_id, "health")["projectId"] == health
    assert parse_with_project(user_id, " HEALTH ")["projectId"] == health
    assert parse_with_project(user_id, "Fitness")["projectId"] is None
    assert parse_with_project(user_id, None)["projectId"] is None


def test_parse_understands_nested_project_paths_and_unique_leaf_names(
    user_id: int,
) -> None:
    work = add_project(user_id, "Work")
    reports = add_project(user_id, "Reports", work)
    home = add_project(user_id, "Home")
    add_project(user_id, "Reports", home)

    assert parse_with_project(user_id, "Work / Reports")["projectId"] == reports
    assert parse_with_project(user_id, "Reports")["projectId"] is None
    assert parse_with_project(user_id, "work")["projectId"] == work


def test_parse_only_offers_the_models_the_users_own_projects(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other = make_user("other@example.com")
    add_project(other, "Secret garden")
    add_project(user_id, "Health")

    with mock.patch.object(
        ai_service, "get_generated_text", return_value=reply(GYM)
    ) as ask:
        parse_task_with_ai(user_id, "gym")

    prompt = ask.call_args.args[0]
    assert "Health" in prompt and "Secret garden" not in prompt
