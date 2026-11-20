from collections.abc import Callable
from typing import Any

from flask import Blueprint, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import jwt_required
from marshmallow import Schema

from app.schemas.task_schema import (
    BulkMoveSchema,
    BulkPrioritySchema,
    BulkSnoozeSchema,
    BulkTargetSchema,
    SubtaskOrderSchema,
    SubtaskSchema,
    SubtasksCreateSchema,
    TaskListQuerySchema,
    TaskMoveSchema,
    TaskPageSchema,
    TaskRescheduleSchema,
    TaskSchema,
    TaskSnoozeSchema,
    TaskUpdateSchema,
    TrashedTaskSchema,
    TrashPageSchema,
    TrashQuerySchema,
)
from app.services.bulk_target import resolve_task_ids
from app.services.bulk_task_service import (
    complete_tasks,
    delete_tasks,
    move_tasks_to_column,
    set_priority,
    snooze_tasks,
)
from app.services.order_service import move_task
from app.services.snooze_service import snooze_task
from app.services.subtask_service import (
    add_subtasks,
    reorder_subtasks,
    replace_subtasks,
)
from app.services.task_listing import get_all_tasks
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
from app.utils.auth import authenticated_user_id
from app.utils.http import get_json_body

task_bp = Blueprint("tasks", __name__)

BulkAction = Callable[[int, list[int], dict[str, Any]], int]


@task_bp.route("/api/tasks", methods=["GET"])
@jwt_required()
def list_tasks() -> ResponseReturnValue:
    query = TaskListQuerySchema().load(request.args)
    return jsonify(TaskPageSchema().dump(get_all_tasks(authenticated_user_id(), query)))  # type: ignore


@task_bp.route("/api/tasks/trash", methods=["GET"])
@jwt_required()
def list_trash() -> ResponseReturnValue:
    query = TrashQuerySchema().load(request.args)
    return jsonify(TrashPageSchema().dump(get_trash(authenticated_user_id(), **query)))


@task_bp.route("/api/tasks/<int:task_id>/restore", methods=["POST"])
@jwt_required()
def restore(task_id: int) -> ResponseReturnValue:
    return jsonify(
        TrashedTaskSchema().dump(restore_task(authenticated_user_id(), task_id))
    )


@task_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def fetch_task(task_id: int) -> ResponseReturnValue:
    return jsonify(TaskSchema().dump(get_task(authenticated_user_id(), task_id)))


@task_bp.route("/api/tasks", methods=["POST"])
@jwt_required()
def add_task() -> ResponseReturnValue:
    data = TaskSchema().load(get_json_body())
    return jsonify(TaskSchema().dump(create_task(authenticated_user_id(), data))), 201


@task_bp.route("/api/tasks/bulk", methods=["POST"])
@jwt_required()
def add_task_list() -> ResponseReturnValue:
    data = get_json_body(allow_list=True)
    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid data format"}), 400

    tasks = create_tasks(authenticated_user_id(), TaskSchema(many=True).load(data))
    return jsonify({"tasks_created": len(tasks)}), 201


def _run_bulk(schema: Schema, action: BulkAction) -> ResponseReturnValue:
    data = schema.load(get_json_body())
    user_id = authenticated_user_id()
    task_ids = resolve_task_ids(user_id, data)
    updated = action(user_id, task_ids, data)
    return jsonify({"updated": updated, "matched": len(task_ids)})


@task_bp.route("/api/tasks/bulk-complete", methods=["POST"])
@jwt_required()
def complete_task_list() -> ResponseReturnValue:
    return _run_bulk(
        BulkTargetSchema(), lambda user_id, ids, data: complete_tasks(user_id, ids)
    )


@task_bp.route("/api/tasks/bulk-snooze", methods=["POST"])
@jwt_required()
def snooze_task_list() -> ResponseReturnValue:
    return _run_bulk(BulkSnoozeSchema(), snooze_tasks)


@task_bp.route("/api/tasks/bulk-delete", methods=["POST"])
@jwt_required()
def delete_task_list() -> ResponseReturnValue:
    return _run_bulk(
        BulkTargetSchema(), lambda user_id, ids, data: delete_tasks(user_id, ids)
    )


@task_bp.route("/api/tasks/bulk-priority", methods=["POST"])
@jwt_required()
def prioritise_task_list() -> ResponseReturnValue:
    return _run_bulk(
        BulkPrioritySchema(),
        lambda user_id, ids, data: set_priority(user_id, ids, data["priority"]),
    )


@task_bp.route("/api/tasks/bulk-move", methods=["POST"])
@jwt_required()
def move_task_list() -> ResponseReturnValue:
    return _run_bulk(
        BulkMoveSchema(),
        lambda user_id, ids, data: move_tasks_to_column(
            user_id, ids, data["column_id"]
        ),
    )


@task_bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def edit_task(task_id: int) -> ResponseReturnValue:
    data = TaskUpdateSchema().load(get_json_body())
    return jsonify(
        TaskSchema().dump(update_task(authenticated_user_id(), task_id, data))
    )


@task_bp.route("/api/tasks/<int:task_id>/reschedule", methods=["POST"])
@jwt_required()
def reschedule(task_id: int) -> ResponseReturnValue:
    data = TaskRescheduleSchema().load(get_json_body())
    return jsonify(
        TaskSchema().dump(reschedule_task(authenticated_user_id(), task_id, data))  # type: ignore
    )


@task_bp.route("/api/tasks/<int:task_id>/move", methods=["POST"])
@jwt_required()
def move(task_id: int) -> ResponseReturnValue:
    data = TaskMoveSchema().load(get_json_body())
    user_id = authenticated_user_id()
    move_task(user_id, task_id, data.get("after_id"), data.get("before_id"))
    return jsonify(TaskSchema().dump(get_task(user_id, task_id)))  # type: ignore


@task_bp.route("/api/tasks/<int:task_id>/snooze", methods=["POST"])
@jwt_required()
def snooze(task_id: int) -> ResponseReturnValue:
    data = TaskSnoozeSchema().load(get_json_body())
    return jsonify(
        TaskSchema().dump(snooze_task(authenticated_user_id(), task_id, data))  # type: ignore
    )


@task_bp.route("/api/tasks/<int:task_id>/subtasks", methods=["POST"])
@jwt_required()
def add_task_subtasks(task_id: int) -> ResponseReturnValue:
    data = SubtasksCreateSchema().load(get_json_body())
    subtasks = add_subtasks(authenticated_user_id(), task_id, data["subtasks"])
    return jsonify({"subtasks": SubtaskSchema(many=True).dump(subtasks)}), 201


@task_bp.route("/api/tasks/<int:task_id>/subtasks", methods=["PUT"])
@jwt_required()
def replace_task_subtasks(task_id: int) -> ResponseReturnValue:
    data = SubtasksCreateSchema().load(get_json_body())
    subtasks = replace_subtasks(authenticated_user_id(), task_id, data["subtasks"])
    return jsonify({"subtasks": SubtaskSchema(many=True).dump(subtasks)})


@task_bp.route("/api/tasks/<int:task_id>/subtasks/order", methods=["PUT"])
@jwt_required()
def reorder_task_subtasks(task_id: int) -> ResponseReturnValue:
    data = SubtaskOrderSchema().load(get_json_body())
    subtasks = reorder_subtasks(authenticated_user_id(), task_id, data["ids"])
    return jsonify({"subtasks": SubtaskSchema(many=True).dump(subtasks)})


@task_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete(task_id: int) -> ResponseReturnValue:
    delete_task(authenticated_user_id(), task_id)
    return jsonify({"id": task_id, "message": "Deleted successfully"})
