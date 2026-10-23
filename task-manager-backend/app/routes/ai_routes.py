from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.ai_service import (
    generate_daily_brief,
    parse_task_with_ai,
    decompose_task,
)
from app.utils.formatters import format_json_response
from app.extensions import ai_daily_limit, limiter, user_key
from app.utils.http import get_json_body
from app.schemas.ai_schema import DecomposeSchema, ParseTaskSchema

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
    data = ParseTaskSchema().load(get_json_body())

    task_data = parse_task_with_ai(data["text"])
    return jsonify(task_data), 200


@ai_bp.route("/api/ai/decompose", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
@limiter.limit(ai_daily_limit, key_func=user_key, scope="ai-daily")
def decompose_task_route():
    data = DecomposeSchema().load(get_json_body())

    decomposed_tasks = decompose_task(
        data["title"],
        data.get("description") or "",
        data.get("category") or "",
        data.get("startAt") or "",
        data.get("endAt") or "",
    )

    if len(decomposed_tasks) == 0:
        return jsonify({"error": "Could not decommpose task "}), 400

    return jsonify({"tasks": format_json_response(decomposed_tasks)})
