from typing import Any

from app.models import Task
from app.schemas.task_schema import TaskSchema
from app.services.task_service import create_task

DEFAULT_PASSWORD = "Sturdy-pass9"

Slot = tuple[str, str]
MONDAY: Slot = ("2026-03-02 09:00:00", "2026-03-02 10:00:00")
TUESDAY: Slot = ("2026-03-03 09:00:00", "2026-03-03 10:00:00")
NEXT_MONDAY: Slot = ("2026-03-09 09:00:00", "2026-03-09 10:00:00")

CONTACT = {
    "fullName": "Ann Visitor",
    "email": "ann@example.com",
    "subject": "Bug Report",
    "message": "Something is broken on the page.",
}


def task_body(**overrides: Any) -> dict[str, Any]:
    return {
        "title": "Write report",
        "description": "Quarterly numbers",
        "category": "work",
        "startAt": "2026-03-02 10:00:00",
        "endAt": "2026-03-02 11:00:00",
        **overrides,
    }


def register_body(**overrides: Any) -> dict[str, Any]:
    return {
        "firstName": "New",
        "lastName": "Person",
        "email": "new@example.com",
        "password": DEFAULT_PASSWORD,
        "confirmPassword": DEFAULT_PASSWORD,
        **overrides,
    }


def reschedule_body(
    previous: Slot, new: Slot, is_ghost: bool = False
) -> dict[str, Any]:
    return {
        "previousStartAt": previous[0],
        "previousEndAt": previous[1],
        "startAt": new[0],
        "endAt": new[1],
        "isGhost": is_ghost,
    }


def add_task(user_id: int, **overrides: Any) -> Task:
    body = task_body(**{"startAt": MONDAY[0], "endAt": MONDAY[1], **overrides})
    return create_task(user_id, TaskSchema().load(body))
