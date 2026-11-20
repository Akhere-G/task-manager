from flask import Blueprint, jsonify
from flask.typing import ResponseReturnValue
from flask_jwt_extended import jwt_required

from app.schemas.project_schema import ProjectSchema, ProjectUpdateSchema
from app.services.project_service import (
    create_project,
    delete_project,
    list_projects,
    update_project,
)
from app.utils.auth import authenticated_user_id
from app.utils.http import get_json_body

project_bp = Blueprint("projects", __name__)


@project_bp.route("/api/projects", methods=["GET"])
@jwt_required()
def list_all() -> ResponseReturnValue:
    projects = list_projects(authenticated_user_id())
    return jsonify({"projects": ProjectSchema(many=True).dump(projects)})


@project_bp.route("/api/projects", methods=["POST"])
@jwt_required()
def add() -> ResponseReturnValue:
    data = ProjectSchema().load(get_json_body())
    project = create_project(authenticated_user_id(), data)
    return jsonify(ProjectSchema().dump(project)), 201


@project_bp.route("/api/projects/<int:project_id>", methods=["PATCH"])
@jwt_required()
def edit(project_id: int) -> ResponseReturnValue:
    data = ProjectUpdateSchema().load(get_json_body())
    project = update_project(authenticated_user_id(), project_id, data)
    return jsonify(ProjectSchema().dump(project))


@project_bp.route("/api/projects/<int:project_id>", methods=["DELETE"])
@jwt_required()
def remove(project_id: int) -> ResponseReturnValue:
    delete_project(authenticated_user_id(), project_id)
    return jsonify({"id": project_id, "message": "Deleted successfully"})
