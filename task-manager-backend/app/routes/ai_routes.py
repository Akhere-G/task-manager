from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.ai_service import (
    generate_daily_brief,
    parse_task_with_ai,
    decompose_task,
)
from app.utils.formatters import format_json_response
from app.extensions import limiter
from app.utils.http import get_json_body
from app.utils.quota import ai_quota
from app.utils.validators import validate_decompose, validate_parse_task

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
@ai_quota
def parse_task_route():
    data = get_json_body()
    errors = validate_parse_task(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    task_data = parse_task_with_ai(data["text"])
    return jsonify(task_data), 200


@ai_bp.route("/api/ai/decompose", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
@ai_quota
def decompose_task_route():
    data = get_json_body()
    errors = validate_decompose(data)
    if errors:
        return jsonify({"errors": errors}), 400

    title = data.get("title", "")
    description = data.get("description", "")
    category = data.get("category", "")
    start_at = data.get("start_at", "")
    end_at = data.get("end_at", "")

    decomposed_tasks = decompose_task(title, description, category, start_at, end_at)

    if len(decomposed_tasks) == 0:
        return jsonify({"error": "Could not decommpose task "}), 400

    return jsonify({"tasks": format_json_response(decomposed_tasks)})
