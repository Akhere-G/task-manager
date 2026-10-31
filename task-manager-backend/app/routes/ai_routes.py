from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.ai_service import (
    generate_daily_brief,
    parse_task_with_ai,
    decompose_task,
)
from app.exceptions import AIUnavailable
from app.extensions import ai_daily_limit, limiter, user_key
from app.schemas.ai_schema import DecomposeRequestSchema, ParseTaskRequestSchema
from app.utils.http import get_json_body

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/daily-brief", methods=["GET"])
@jwt_required()
def get_daily_brief_route():
    user_id = get_jwt_identity()

    brief_text, is_fallback = generate_daily_brief(user_id, request.args.get("tz"))

    return jsonify({"success": True, "brief": brief_text, "fallback": is_fallback}), 200


@ai_bp.route("/api/ai/parse-task", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
@limiter.limit(ai_daily_limit, key_func=user_key, scope="ai-daily")
def parse_task_route():
    data = ParseTaskRequestSchema().load(get_json_body())
    return jsonify(parse_task_with_ai(data["text"]))


@ai_bp.route("/api/ai/decompose", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
@limiter.limit(ai_daily_limit, key_func=user_key, scope="ai-daily")
def decompose_task_route():
    data = DecomposeRequestSchema().load(get_json_body())

    tasks = decompose_task(
        data["title"],
        data.get("description") or "",
        data.get("category") or "",
        data.get("start_at") or "",
        data.get("end_at") or "",
    )
    if not tasks:
        raise AIUnavailable("Could not decompose the task.")

    return jsonify({"tasks": tasks})
