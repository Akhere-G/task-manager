from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.schemas.task_schema import (
    TaskListQuerySchema,
    TaskPageSchema,
    TaskRescheduleSchema,
    TaskSchema,
    TaskUpdateSchema,
)
from app.services.task_service import (
    create_task,
    create_tasks,
    delete_task,
    get_all_tasks,
    get_task,
    reschedule_task,
    update_task,
)
from app.utils.http import get_json_body

task_bp = Blueprint("tasks", __name__)


@task_bp.route("/api/tasks", methods=["GET"])
@jwt_required()
def list_tasks():
    query = TaskListQuerySchema().load(request.args)
    return jsonify(TaskPageSchema().dump(get_all_tasks(get_jwt_identity(), query)))


@task_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def fetch_task(task_id):
    return jsonify(TaskSchema().dump(get_task(get_jwt_identity(), task_id)))


@task_bp.route("/api/tasks", methods=["POST"])
@jwt_required()
def add_task():
    data = TaskSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(create_task(get_jwt_identity(), data))), 201


@task_bp.route("/api/tasks/bulk", methods=["POST"])
@jwt_required()
def add_task_list():
    data = get_json_body(allow_list=True)
    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid data format"}), 400

    tasks = create_tasks(get_jwt_identity(), TaskSchema(many=True).load(data))
    return jsonify({"tasks_created": len(tasks)}), 201


@task_bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def edit_task(task_id):
    data = TaskUpdateSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(update_task(get_jwt_identity(), task_id, data)))


@task_bp.route("/api/tasks/<int:task_id>/reschedule", methods=["POST"])
@jwt_required()
def reschedule(task_id):
    data = TaskRescheduleSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(reschedule_task(get_jwt_identity(), task_id, data)))


@task_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete(task_id):
    delete_task(get_jwt_identity(), task_id)
    return jsonify({"id": task_id, "message": "Deleted successfully"})
