from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.formatters import format_json_response
from services.stats_service import get_all_dashboard_stats

stats_bp = Blueprint("stats", __name__)


@stats_bp.route("/api/stats/dashboard", methods=["GET"])
@jwt_required()
def fetch_dashboard_data():
    """
    Unified endpoint to fetch all dashboard statistics in a single request.
    Reduces database connection overhead and improves frontend load performance.
    """
    user_id = get_jwt_identity()

    try:
        stats_data = get_all_dashboard_stats(user_id)

        return jsonify(format_json_response(stats_data)), 200

    except ValueError:
        return jsonify({"error": "The 'days' parameter must be an integer."}), 400
    except Exception as e:
        print(f"Dashboard Fetch Error: {str(e)}")
        return jsonify(
            {"error": "An unexpected error occurred while fetching stats."}
        ), 500
