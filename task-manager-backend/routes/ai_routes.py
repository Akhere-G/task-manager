from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.ai_service import generate_daily_brief

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
