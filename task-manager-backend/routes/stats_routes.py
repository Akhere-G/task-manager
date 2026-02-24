from flask import Blueprint, request, jsonify
from utils.formatters import format_json_response
from services.stats_service import get_productivity_trend, get_time_spent, get_backlog_health, get_category_volume, get_overdue_distribution, get_category_velocity
from flask_jwt_extended import jwt_required, get_jwt_identity

stats_bp = Blueprint("stats", __name__)

@stats_bp.route('/api/stats/productivity', methods=['GET'])
@jwt_required()
def fetch_productivity_data():
  user_id = get_jwt_identity()
  days = request.args.get('days', 30)
  try:
    int_days = int(days)
    data = get_productivity_trend(user_id, int_days)
  except (ValueError, TypeError):
    return jsonify({ 'error': "Days must be a number" }), 400

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/timespent', methods=['GET'])
@jwt_required()
def fetch_time_spent_data():
  user_id = get_jwt_identity()
  data = get_time_spent(user_id)

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/backloghealth', methods=["GET"])
@jwt_required()
def fetch_backlog_health():
  user_id = get_jwt_identity()
  data = get_backlog_health(user_id)

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/categoryvolume', methods=["GET"])
@jwt_required()
def fetch_category_volume():
  user_id = get_jwt_identity()
  data = get_category_volume(user_id)

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/overduedistribution')
@jwt_required()
def fetch_overdue_distribution():
  user_id = get_jwt_identity()
  data = get_overdue_distribution(user_id)

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/categoryvelocity')
@jwt_required()
def fetch_get_category_velocity():
  user_id = get_jwt_identity()
  data = get_category_velocity(user_id)

  return jsonify(format_json_response(data)), 200

