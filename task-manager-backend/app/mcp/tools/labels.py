from typing import Any

from app.mcp.registry import Tool
from app.mcp.schemas import EmptySchema
from app.models import TokenScope
from app.schemas.label_schema import LabelSchema, LabelUpdateSchema
from app.services.label_service import (
    create_label,
    delete_label,
    list_labels,
    update_label,
)


def _list_labels(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return {"labels": LabelSchema(many=True).dump(list_labels(user_id))}


def _create_label(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return LabelSchema().dump(create_label(user_id, data))


def _update_label(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    label_id = data.pop("id")
    return LabelSchema().dump(update_label(user_id, label_id, data))


def _delete_label(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    delete_label(user_id, data["id"])
    return {"id": data["id"], "message": "Deleted"}


LABEL_TOOLS = (
    Tool(
        name="list_labels",
        title="List labels",
        description=(
            "List the user's labels. A task has up to 10; attach them with labelIds "
            "or labelNames when creating or updating a task."
        ),
        input=EmptySchema,
        scope=TokenScope.READ,
        run=_list_labels,
    ),
    Tool(
        name="create_label",
        title="Create a label",
        description="Create a label. Names are unique, ignoring case.",
        input=LabelSchema,
        scope=TokenScope.WRITE,
        run=_create_label,
    ),
    Tool(
        name="update_label",
        title="Update a label",
        description="Rename or recolour a label. Only the fields given change.",
        input=LabelUpdateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_update_label,
        idempotent=True,
    ),
    Tool(
        name="delete_label",
        title="Delete a label",
        description=(
            "Permanently delete a label and remove it from every task. This cannot "
            "be undone. Confirm with the user before calling."
        ),
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_delete_label,
        destructive=True,
    ),
)
