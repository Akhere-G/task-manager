from flask import Blueprint, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.schemas.task_schema import (
    SubtaskSchema,
    SubtasksCreateSchema,
    TaskCountsQuerySchema,
    TaskListQuerySchema,
    TaskPageSchema,
    TaskRescheduleSchema,
    TaskSchema,
    TaskUpdateSchema,
    TrashedTaskSchema,
    TrashPageSchema,
    TrashQuerySchema,
)
from app.services.subtask_service import add_subtasks
from app.services.task_listing import count_open_tasks_by_view, get_all_tasks
from app.services.task_service import (
    create_task,
    create_tasks,
    delete_task,
    get_task,
    get_trash,
    reschedule_task,
    restore_task,
    update_task,
)
from app.utils.http import get_json_body

task_bp = Blueprint("tasks", __name__)


@task_bp.route("/api/tasks", methods=["GET"])
@jwt_required()
def list_tasks() -> ResponseReturnValue:
    query = TaskListQuerySchema().load(request.args)
    return jsonify(TaskPageSchema().dump(get_all_tasks(get_jwt_identity(), query)))  # type: ignore


@task_bp.route("/api/tasks/counts", methods=["GET"])
@jwt_required()
def view_counts() -> ResponseReturnValue:
    query = TaskCountsQuerySchema().load(request.args)
    return jsonify({"counts": count_open_tasks_by_view(get_jwt_identity(), **query)})


@task_bp.route("/api/tasks/trash", methods=["GET"])
@jwt_required()
def list_trash() -> ResponseReturnValue:
    query = TrashQuerySchema().load(request.args)
    return jsonify(TrashPageSchema().dump(get_trash(get_jwt_identity(), **query)))


@task_bp.route("/api/tasks/<int:task_id>/restore", methods=["POST"])
@jwt_required()
def restore(task_id: int) -> ResponseReturnValue:
    return jsonify(TrashedTaskSchema().dump(restore_task(get_jwt_identity(), task_id)))


@task_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def fetch_task(task_id: int) -> ResponseReturnValue:
    return jsonify(TaskSchema().dump(get_task(get_jwt_identity(), task_id)))


@task_bp.route("/api/tasks", methods=["POST"])
@jwt_required()
def add_task() -> ResponseReturnValue:
    data = TaskSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(create_task(get_jwt_identity(), data))), 201


@task_bp.route("/api/tasks/bulk", methods=["POST"])
@jwt_required()
def add_task_list() -> ResponseReturnValue:
    data = get_json_body(allow_list=True)
    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid data format"}), 400

    tasks = create_tasks(get_jwt_identity(), TaskSchema(many=True).load(data))
    return jsonify({"tasks_created": len(tasks)}), 201


@task_bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def edit_task(task_id: int) -> ResponseReturnValue:
    data = TaskUpdateSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(update_task(get_jwt_identity(), task_id, data)))


@task_bp.route("/api/tasks/<int:task_id>/reschedule", methods=["POST"])
@jwt_required()
def reschedule(task_id: int) -> ResponseReturnValue:
    data = TaskRescheduleSchema().load(get_json_body())
    return jsonify(
        TaskSchema().dump(reschedule_task(get_jwt_identity(), task_id, data))  # type: ignore
    )


@task_bp.route("/api/tasks/<int:task_id>/subtasks", methods=["POST"])
@jwt_required()
def add_task_subtasks(task_id: int) -> ResponseReturnValue:
    data = SubtasksCreateSchema().load(get_json_body())
    subtasks = add_subtasks(get_jwt_identity(), task_id, data["subtasks"])
    return jsonify({"subtasks": SubtaskSchema(many=True).dump(subtasks)}), 201


@task_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete(task_id: int) -> ResponseReturnValue:
    delete_task(get_jwt_identity(), task_id)
    return jsonify({"id": task_id, "message": "Deleted successfully"})
