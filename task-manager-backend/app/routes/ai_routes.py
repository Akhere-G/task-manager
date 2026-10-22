from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.ai_service import (
    generate_daily_brief,
    parse_task_with_ai,
    decompose_task,
)
from app.utils.formatters import format_json_response
from app.utils.http import get_json_body

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/daily-brief", methods=["GET"])
@jwt_required()
def get_daily_brief_route():
    user_id = get_jwt_identity()

    brief_text = generate_daily_brief(user_id)

    return jsonify({"success": True, "brief": brief_text}), 200


@ai_bp.route("/api/ai/parse-task", methods=["POST"])
@jwt_required()
def parse_task_route():
    data = get_json_body()
    user_input = data.get("text")
    if not user_input:
        return jsonify({"success": False, "error": "No text provided"}), 400

    task_data = parse_task_with_ai(user_input)
    return jsonify(task_data), 200


@ai_bp.route("/api/ai/decompose", methods=["POST"])
@jwt_required()
def decompose_task_route():
    data = get_json_body()

    title = data.get("title", "")
    description = data.get("description", "")
    category = data.get("category", "")
    start_at = data.get("start_at", "")
    end_at = data.get("end_at", "")

    decomposed_tasks = decompose_task(title, description, category, start_at, end_at)

    if len(decomposed_tasks) == 0:
        return jsonify({"error": "Could not decommpose task "}), 400

    return jsonify({"tasks": format_json_response(decomposed_tasks)})
