from flask import Blueprint, request, jsonify
from app.utils.formatters import format_json_response
from app.utils.validators import validate_task, validate_task_list
from app.services.task_service import (
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
    category = request.args.get("category")
    search = request.args.get("q")
    duration = request.args.get("duration")
    is_completed = request.args.get("is_completed")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    sort_by = request.args.get("sort_by")
    order = request.args.get("order")
    page = request.args.get("page")
    limit = request.args.get("limit")
    project_repeating = (
        True if request.args.get("project_repeating") == "true" else False
    )

    raw_tasks = get_all_tasks(
        user_id,
        category,
        search,
        duration,
        is_completed,
        start_date,
        end_date,
        sort_by,
        order,
        limit,
        page,
        project_repeating,
    )
    return jsonify(format_json_response(raw_tasks))


@task_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def fetch_task(task_id):
    user_id = get_jwt_identity()

    try:
        task = get_task(user_id, task_id)

        if task:
            return jsonify(format_json_response(task)), 200

        return jsonify({"error": "No task with that id"}), 404

    except Exception:
        return jsonify({"error": "An internal server error occurred"}), 500


@task_bp.route("/api/tasks", methods=["POST"])
@jwt_required()
def add_task():
    user_id = get_jwt_identity()
    data = request.json

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
    data = request.json

    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid data format"}), 400

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

    try:
        count = create_tasks_from_list(user_id, data)
        return jsonify({"tasks_created": count}), 201
    except Exception:
        return jsonify({"error": "Database operation failed"}), 500


@task_bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def edit_task(task_id):
    user_id = get_jwt_identity()
    data = request.json
    errors = validate_task(data, True)

    if errors:
        return jsonify({"errors": errors}), 400

    updated_result = update_task(user_id, task_id, data)

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
