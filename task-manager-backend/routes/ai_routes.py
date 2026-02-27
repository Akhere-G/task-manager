from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.ai_service import generate_daily_brief, parse_task_with_ai

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/daily-brief", methods=["GET"])
@jwt_required()
def get_daily_brief_route():
    try:
        user_id = get_jwt_identity()

        brief_text = generate_daily_brief(user_id)

        return jsonify({"success": True, "brief": brief_text}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@ai_bp.route("/api/ai/parse-task", methods=["POST"])
@jwt_required()
def parse_task_route():
    try:
        data = request.json
        user_input = data.get("text")
        if not user_input:
            return jsonify({"success": False, "error": "No text provided"}), 400

        task_data = parse_task_with_ai(user_input)
        return jsonify(task_data), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
