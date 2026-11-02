from collections.abc import Iterable
from typing import Any

from sqlalchemy import delete, func, insert, select

from app.database import db
from app.exceptions import InvalidLabel, LabelNameTaken, LabelNotFound
from app.models import Label, Task, TaskLabel


def list_labels(user_id: int) -> list[Label]:
    stmt = select(Label).where(Label.user_id == user_id).order_by(Label.name, Label.id)
    return list(db.session.scalars(stmt))


def get_label(user_id: int, label_id: int) -> Label:
    label = db.session.scalar(
        select(Label).where(Label.user_id == user_id, Label.id == label_id)
    )
    if label is None:
        raise LabelNotFound()
    return label


def _check_name_free(user_id: int, name: str, except_id: int | None = None) -> None:
    stmt = select(Label.id).where(
        Label.user_id == user_id, func.lower(Label.name) == name.lower()
    )
    if except_id is not None:
        stmt = stmt.where(Label.id != except_id)
    if db.session.scalar(stmt) is not None:
        raise LabelNameTaken()


def create_label(user_id: int, data: dict[str, Any]) -> Label:
    _check_name_free(user_id, data["name"])
    label = Label(**data, user_id=user_id)
    db.session.add(label)
    db.session.commit()
    return label


def update_label(user_id: int, label_id: int, data: dict[str, Any]) -> Label:
    label = get_label(user_id, label_id)
    if "name" in data:
        _check_name_free(user_id, data["name"], except_id=label_id)
    for field, value in data.items():
        setattr(label, field, value)
    db.session.commit()
    return label


def delete_label(user_id: int, label_id: int) -> None:
    db.session.delete(get_label(user_id, label_id))
    db.session.commit()


def ensure_labels_belong_to(user_id: int, label_ids: Iterable[int]) -> None:
    wanted = set(label_ids)
    if not wanted:
        return
    owned = db.session.scalar(
        select(func.count())
        .select_from(Label)
        .where(Label.user_id == user_id, Label.id.in_(wanted))
    )
    if owned != len(wanted):
        raise InvalidLabel()


def set_task_labels(task_ids: list[int], label_ids: Iterable[int]) -> None:
    wanted = sorted(set(label_ids))
    db.session.execute(delete(TaskLabel).where(TaskLabel.task_id.in_(task_ids)))
    if wanted:
        db.session.execute(
            insert(TaskLabel),
            [
                {"task_id": task_id, "label_id": label_id}
                for task_id in task_ids
                for label_id in wanted
            ],
        )


def attach_label_ids(tasks: Iterable[Task]) -> None:
    """Sets `label_ids` on each task with one query; ghosts use their series' labels."""
    tasks = list(tasks)
    owners = {_label_owner_id(task) for task in tasks}
    rows = db.session.execute(
        select(TaskLabel.task_id, TaskLabel.label_id)
        .where(TaskLabel.task_id.in_(owners))
        .order_by(TaskLabel.label_id)
    )
    by_task: dict[int, list[int]] = {}
    for task_id, label_id in rows:
        by_task.setdefault(task_id, []).append(label_id)
    for task in tasks:
        task.label_ids = by_task.get(_label_owner_id(task), [])  # type: ignore


def _label_owner_id(task: Task) -> int:
    return task.series_id if getattr(task, "is_ghost", False) else task.id  # type: ignore
