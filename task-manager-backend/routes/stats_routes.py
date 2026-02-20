from flask import Blueprint, request, jsonify
from utils.formatters import format_json_response
from services.stats_service import get_productivity_trend, get_time_spent, get_backlog_health, get_category_volume

stats_bp = Blueprint("stats", "stats")

@stats_bp.route('/api/stats/productivity', methods=['GET'])
def fetch_productivity_data():
  days = request.args.get('days', 30)
  try:
    int_days = int(days)
    data = get_productivity_trend(int_days)
  except (ValueError, TypeError):
    return jsonify({ 'error': "Days must be a number" }), 400

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/timespent', methods=['GET'])
def fetch_time_spent_data():
  data = get_time_spent()

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/backloghealth', methods=["GET"])
def fetch_backlog_health():
  data = get_backlog_health()

  return jsonify(format_json_response(data)), 200

@stats_bp.route('/api/stats/categoryvolume', methods=["GET"])
def fetch_category_volume():
  data = get_category_volume()

  return jsonify(format_json_response(data)), 200

