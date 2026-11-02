from flask import Blueprint, jsonify
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.schemas.label_schema import LabelSchema, LabelUpdateSchema
from app.services.label_service import (
    create_label,
    delete_label,
    list_labels,
    update_label,
)
from app.utils.http import get_json_body

label_bp = Blueprint("labels", __name__)


@label_bp.route("/api/labels", methods=["GET"])
@jwt_required()
def list_all() -> ResponseReturnValue:
    labels = list_labels(get_jwt_identity())
    return jsonify({"labels": LabelSchema(many=True).dump(labels)})


@label_bp.route("/api/labels", methods=["POST"])
@jwt_required()
def add() -> ResponseReturnValue:
    data = LabelSchema().load(get_json_body())
    label = create_label(get_jwt_identity(), data)
    return jsonify(LabelSchema().dump(label)), 201


@label_bp.route("/api/labels/<int:label_id>", methods=["PATCH"])
@jwt_required()
def edit(label_id: int) -> ResponseReturnValue:
    data = LabelUpdateSchema().load(get_json_body())
    label = update_label(get_jwt_identity(), label_id, data)
    return jsonify(LabelSchema().dump(label))


@label_bp.route("/api/labels/<int:label_id>", methods=["DELETE"])
@jwt_required()
def remove(label_id: int) -> ResponseReturnValue:
    delete_label(get_jwt_identity(), label_id)
    return jsonify({"id": label_id, "message": "Deleted successfully"})
