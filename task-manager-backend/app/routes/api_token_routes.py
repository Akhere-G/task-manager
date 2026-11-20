from flask import Blueprint, jsonify
from flask.typing import ResponseReturnValue
from flask_jwt_extended import jwt_required

from app.exceptions import DemoForbidden
from app.schemas.api_token_schema import ApiTokenSchema
from app.services.api_token_service import (
    create_api_token,
    delete_api_token,
    list_api_tokens,
)
from app.services.auth_service import is_demo_user
from app.utils.auth import authenticated_user_id
from app.utils.http import get_json_body

api_token_bp = Blueprint("api_tokens", __name__)


@api_token_bp.route("/api/api-tokens", methods=["GET"])
@jwt_required()
def list_all() -> ResponseReturnValue:
    tokens = list_api_tokens(authenticated_user_id())
    return jsonify({"tokens": ApiTokenSchema(many=True).dump(tokens)})


@api_token_bp.route("/api/api-tokens", methods=["POST"])
@jwt_required()
def add() -> ResponseReturnValue:
    user_id = authenticated_user_id()
    if is_demo_user(user_id):
        raise DemoForbidden()
    data = ApiTokenSchema().load(get_json_body())
    token, plaintext = create_api_token(user_id, data["name"], data["scope"])
    return jsonify({**ApiTokenSchema().dump(token), "token": plaintext}), 201


@api_token_bp.route("/api/api-tokens/<int:token_id>", methods=["DELETE"])
@jwt_required()
def remove(token_id: int) -> ResponseReturnValue:
    delete_api_token(authenticated_user_id(), token_id)
    return jsonify({"id": token_id, "message": "Deleted successfully"})
