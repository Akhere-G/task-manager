from flask import Blueprint, request, jsonify
from app.utils.formatters import format_json_response
from app.utils.http import get_json_body
from app.utils.validators import (
    parse_list_params,
    validate_task,
    validate_task_list,
)
from app.services.task_service import (
    TaskConflict,
    TaskValidationError,
    get_all_tasks,
    create_task,
    update_task,
    delete_task,
    create_tasks_from_list,
    get_task,
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

task_bp = Blueprint("tasks", __name__)


@task_bp.route("/api/tasks", methods=["GET"])
@jwt_required()
def list_tasks():
    user_id = get_jwt_identity()
    params, errors = parse_list_params(request.args)
    if errors:
        return jsonify({"errors": errors}), 400

    raw_tasks = get_all_tasks(
        user_id,
        params["category"],
        params["search"],
        params["duration"],
        params["is_completed"],
        params["start_date"],
        params["end_date"],
        params["sort_by"],
        params["order"],
        params["limit"],
        params["page"],
        params["project_repeating"],
    )
    return jsonify(format_json_response(raw_tasks))


@task_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def fetch_task(task_id):
    user_id = get_jwt_identity()

    task = get_task(user_id, task_id)

    if task:
        return jsonify(format_json_response(task)), 200

    return jsonify({"error": "No task with that id"}), 404


@task_bp.route("/api/tasks", methods=["POST"])
@jwt_required()
def add_task():
    user_id = get_jwt_identity()
    data = get_json_body()

    if data.get("repeatBy"):
        data["isRepeating"] = True

    errors = validate_task(data)

    if errors:
        return jsonify({"errors": errors}), 400

    task_id = create_task(user_id, data)

    data["id"] = task_id
    return jsonify(format_json_response(data)), 201


@task_bp.route("/api/tasks/bulk", methods=["POST"])
@jwt_required()
def add_task_list():
    user_id = get_jwt_identity()
    data = get_json_body(allow_list=True)

    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid data format"}), 400

    if not all(isinstance(task, dict) for task in data):
        return jsonify({"error": "Every task must be an object"}), 400

    for task in data:
        is_comp = task.get("isCompleted", False)
        comp_at = task.get("completedAt")

        if is_comp and not comp_at:
            task["completedAt"] = datetime.now(timezone.utc).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        elif not is_comp:
            task["completedAt"] = None

        task["isCompleted"] = is_comp

        if task.get("repeatBy"):
            task["isRepeating"] = True

    errors, has_errors = validate_task_list(data)

    if has_errors:
        return jsonify({"errors": errors}), 400

    count = create_tasks_from_list(user_id, data)
    return jsonify({"tasks_created": count}), 201


@task_bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def edit_task(task_id):
    user_id = get_jwt_identity()
    data = get_json_body()
    errors = validate_task(data, True)

    if errors:
        return jsonify({"errors": errors}), 400

    try:
        updated_result = update_task(user_id, task_id, data)
    except TaskValidationError as error:
        return jsonify({"errors": {error.field: error.message}}), 400
    except TaskConflict as conflict:
        return jsonify(
            {
                "error": "This task was already updated.",
                "task": format_json_response(conflict.task),
            }
        ), 409

    if updated_result is None:
        return jsonify({"error": f"No task with the id {task_id} exists."}), 404

    return jsonify(format_json_response(updated_result)), 200


@task_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete(task_id):
    user_id = get_jwt_identity()
    deleted_id = delete_task(user_id, task_id)

    if deleted_id is not None:
        return jsonify({"id": deleted_id, "message": "Deleted successfully"}), 200

    return jsonify({"error": f"No task with the id {task_id} exists."}), 404
