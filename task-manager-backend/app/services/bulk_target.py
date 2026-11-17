from typing import Any

from sqlalchemy import select

from app.constants import MAX_BULK_FILTER_TASKS
from app.database import db
from app.models import Task
from app.utils.task_utils import build_task_clauses


def resolve_task_ids(user_id: int, target: dict[str, Any]) -> list[int]:
    if "ids" in target:
        return target["ids"]
    clauses = build_task_clauses(user_id, target["filter"])
    stmt = select(Task.id).where(*clauses).order_by(Task.id)
    return list(db.session.scalars(stmt.limit(MAX_BULK_FILTER_TASKS)))
