from typing import Any

from app.mcp.registry import Tool
from app.mcp.schemas import EmptySchema
from app.models import TokenScope
from app.schemas.project_schema import ProjectSchema, ProjectUpdateSchema
from app.services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)


def _list_projects(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return {"projects": ProjectSchema(many=True).dump(list_projects(user_id))}


def _get_project(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return ProjectSchema().dump(get_project(user_id, data["id"]))


def _create_project(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return ProjectSchema().dump(create_project(user_id, data))


def _update_project(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_id = data.pop("id")
    return ProjectSchema().dump(update_project(user_id, project_id, data))


def _delete_project(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    delete_project(user_id, data["id"])
    return {"id": data["id"], "message": "Deleted"}


PROJECT_TOOLS = (
    Tool(
        name="list_projects",
        title="List projects",
        description=(
            "List the user's projects. A project's parentId nests it inside another. "
            "Tasks with no project are in the inbox."
        ),
        input=EmptySchema,
        scope=TokenScope.READ,
        run=_list_projects,
    ),
    Tool(
        name="get_project",
        title="Get a project",
        description="Get one project by id.",
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.READ,
        run=_get_project,
    ),
    Tool(
        name="create_project",
        title="Create a project",
        description=(
            "Create a project, optionally inside another with parentId. Names are "
            "unique among siblings and projects nest at most three levels deep."
        ),
        input=ProjectSchema,
        scope=TokenScope.WRITE,
        run=_create_project,
    ),
    Tool(
        name="update_project",
        title="Update a project",
        description="Rename, recolour or move a project. Only the fields given change.",
        input=ProjectUpdateSchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_update_project,
        idempotent=True,
    ),
    Tool(
        name="delete_project",
        title="Delete a project",
        description=(
            "Permanently delete a project and all its sub-projects. This cannot be "
            "undone. The tasks in them move to the inbox. Confirm with the user "
            "before calling."
        ),
        input=EmptySchema,
        takes_id=True,
        scope=TokenScope.WRITE,
        run=_delete_project,
        destructive=True,
    ),
)
