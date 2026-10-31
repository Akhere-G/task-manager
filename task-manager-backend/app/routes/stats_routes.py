from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.formatters import format_json_response
from app.services.stats_service import get_all_dashboard_stats

stats_bp = Blueprint(
    "stats",
    __name__,
)


@stats_bp.route("/api/stats/dashboard", methods=["GET"])
@jwt_required()
def fetch_dashboard_data():
    user_id = get_jwt_identity()

    stats_data = get_all_dashboard_stats(user_id)

    return jsonify(format_json_response(stats_data)), 200
