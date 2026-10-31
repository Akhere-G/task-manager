from flask import Blueprint, jsonify
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.services.stats_service import get_all_dashboard_stats
from app.utils.formatters import format_json_response

stats_bp = Blueprint(
    "stats",
    __name__,
)


@stats_bp.route("/api/stats/dashboard", methods=["GET"])
@jwt_required()
def fetch_dashboard_data() -> ResponseReturnValue:
    user_id = get_jwt_identity()

    stats_data = get_all_dashboard_stats(user_id)

    return jsonify(format_json_response(stats_data)), 200
