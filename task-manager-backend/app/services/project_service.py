from collections.abc import Iterable
from typing import Any

from sqlalchemy import func, select, update

from app.constants import INBOX_NAME, MAX_PROJECT_DEPTH
from app.database import db
from app.exceptions import (
    InvalidProject,
    ProjectCycle,
    ProjectNameTaken,
    ProjectNotFound,
    ProjectTooDeep,
)
from app.models import Project
from app.utils.project_tree import (
    Parents,
    depth_of,
    descendant_ids,
    height_of,
    root_of,
)


def list_projects(user_id: int) -> list[Project]:
    stmt = (
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.position, Project.name, Project.id)
    )
    return list(db.session.scalars(stmt))


def get_project(user_id: int, project_id: int) -> Project:
    project = db.session.scalar(
        select(Project).where(Project.user_id == user_id, Project.id == project_id)
    )
    if project is None:
        raise ProjectNotFound()
    return project


def _parents_of(user_id: int) -> Parents:
    rows = db.session.execute(
        select(Project.id, Project.parent_id).where(Project.user_id == user_id)
    )
    return {project_id: parent_id for project_id, parent_id in rows}


def descendant_project_ids(user_id: int, project_id: int) -> set[int]:
    parents = _parents_of(user_id)
    if project_id not in parents:
        return {project_id}
    return descendant_ids(parents, project_id)


def project_paths(user_id: int) -> dict[int, str]:
    projects = {project.id: project for project in list_projects(user_id)}
    paths = {}
    for project_id in projects:
        names = []
        current: int | None = project_id
        while current is not None:
            names.append(projects[current].name)
            current = projects[current].parent_id
        paths[project_id] = " / ".join(reversed(names))
    return paths


def root_project_names(user_id: int) -> dict[int | None, str]:
    projects = {project.id: project for project in list_projects(user_id)}
    parents = {
        project_id: project.parent_id for project_id, project in projects.items()
    }
    names: dict[int | None, str] = {None: INBOX_NAME}
    for project_id in projects:
        names[project_id] = projects[root_of(parents, project_id)].name
    return names


def ensure_projects_belong_to(user_id: int, project_ids: Iterable[int | None]) -> None:
    wanted = {project_id for project_id in project_ids if project_id is not None}
    if not wanted:
        return
    owned = db.session.scalar(
        select(func.count())
        .select_from(Project)
        .where(Project.user_id == user_id, Project.id.in_(wanted))
    )
    if owned != len(wanted):
        raise InvalidProject()


def _check_name_free(
    user_id: int, parent_id: int | None, name: str, except_id: int | None = None
) -> None:
    stmt = select(Project.id).where(
        Project.user_id == user_id,
        Project.parent_id.is_(None)
        if parent_id is None
        else Project.parent_id == parent_id,
        func.lower(Project.name) == name.lower(),
    )
    if except_id is not None:
        stmt = stmt.where(Project.id != except_id)
    if db.session.scalar(stmt) is not None:
        raise ProjectNameTaken()


def _check_parent(user_id: int, parent_id: int | None, project_id: int | None) -> None:
    if parent_id is None:
        return
    parents = _parents_of(user_id)
    if parent_id not in parents:
        raise InvalidProject(field="parentId")
    if project_id is None:
        subtree_height = 1
    else:
        if parent_id in descendant_ids(parents, project_id):
            raise ProjectCycle()
        subtree_height = height_of(parents, project_id)
    if depth_of(parents, parent_id) + subtree_height > MAX_PROJECT_DEPTH:
        raise ProjectTooDeep()


def create_project(user_id: int, data: dict[str, Any]) -> Project:
    parent_id = data.get("parent_id")
    _check_parent(user_id, parent_id, None)
    _check_name_free(user_id, parent_id, data["name"])
    project = Project(**data, user_id=user_id)
    db.session.add(project)
    db.session.commit()
    return project


def update_project(user_id: int, project_id: int, data: dict[str, Any]) -> Project:
    project = get_project(user_id, project_id)
    parent_id = data.get("parent_id", project.parent_id)
    name = data.get("name", project.name)
    if "parent_id" in data:
        _check_parent(user_id, parent_id, project_id)
    if "parent_id" in data or "name" in data:
        _check_name_free(user_id, parent_id, name, except_id=project_id)
    for field, value in data.items():
        setattr(project, field, value)
    db.session.commit()
    return project


def delete_project(user_id: int, project_id: int) -> None:
    project = get_project(user_id, project_id)
    db.session.execute(
        update(Project)
        .where(Project.user_id == user_id, Project.parent_id == project_id)
        .values(parent_id=project.parent_id)
    )
    db.session.delete(project)
    db.session.commit()
