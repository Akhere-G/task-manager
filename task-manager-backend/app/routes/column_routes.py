from flask import Blueprint, jsonify
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.schemas.column_schema import (
    BoardMoveSchema,
    ColumnDeleteSchema,
    ColumnOrderSchema,
    ColumnSchema,
    ColumnUpdateSchema,
)
from app.schemas.task_schema import TaskSchema
from app.services.board_service import move_task_to_column
from app.services.column_service import (
    create_column,
    delete_column,
    list_columns,
    reorder_columns,
    update_column,
)
from app.services.task_service import get_task
from app.utils.http import get_json_body

column_bp = Blueprint("columns", __name__)


@column_bp.route("/api/projects/<int:project_id>/columns", methods=["GET"])
@jwt_required()
def list_all(project_id: int) -> ResponseReturnValue:
    columns = list_columns(get_jwt_identity(), project_id)
    return jsonify({"columns": ColumnSchema(many=True).dump(columns)})


@column_bp.route("/api/projects/<int:project_id>/columns", methods=["POST"])
@jwt_required()
def add(project_id: int) -> ResponseReturnValue:
    data = ColumnSchema().load(get_json_body())
    column = create_column(get_jwt_identity(), project_id, data)
    return jsonify(ColumnSchema().dump(column)), 201


@column_bp.route("/api/projects/<int:project_id>/columns/order", methods=["PUT"])
@jwt_required()
def reorder(project_id: int) -> ResponseReturnValue:
    data = ColumnOrderSchema().load(get_json_body())
    columns = reorder_columns(get_jwt_identity(), project_id, data["column_ids"])
    return jsonify({"columns": ColumnSchema(many=True).dump(columns)})


@column_bp.route("/api/columns/<int:column_id>", methods=["PATCH"])
@jwt_required()
def edit(column_id: int) -> ResponseReturnValue:
    data = ColumnUpdateSchema().load(get_json_body())
    column = update_column(get_jwt_identity(), column_id, data)
    return jsonify(ColumnSchema().dump(column))


@column_bp.route("/api/columns/<int:column_id>", methods=["DELETE"])
@jwt_required()
def remove(column_id: int) -> ResponseReturnValue:
    data = ColumnDeleteSchema().load(get_json_body())
    delete_column(get_jwt_identity(), column_id, data["move_to_id"])
    return jsonify({"id": column_id, "message": "Deleted successfully"})


@column_bp.route("/api/tasks/<int:task_id>/board-move", methods=["POST"])
@jwt_required()
def board_move(task_id: int) -> ResponseReturnValue:
    data = BoardMoveSchema().load(get_json_body())
    user_id = get_jwt_identity()
    task = move_task_to_column(
        user_id, task_id, data["column_id"], data.get("after_id"), data.get("before_id")
    )
    if task.is_deleted:
        return jsonify({"id": task_id, "deleted": True})
    return jsonify(TaskSchema().dump(get_task(user_id, task_id)))  # type: ignore
