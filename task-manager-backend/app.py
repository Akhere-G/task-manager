import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from services.task_service import get_all_tasks, create_tasks, update_task, delete_task
from utils.formatters import format_json_response
from dotenv import load_dotenv
from utils.validators import validate_task
from services.stats_service import get_productivity_trend, get_time_spent, get_backlog_health

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
  category = request.args.get("category")
  search = request.args.get("q")
  task_duration = request.args.get("task_duration")
  is_completed = request.args.get("is_completed")
  due_date = request.args.get('due_date')
  today = request.args.get('today')
  sort_by = request.args.get('sort_by')
  order = request.args.get('order')
  page = request.args.get('page')
  limit = request.args.get('limit')

  raw_tasks = get_all_tasks(
    category, 
    search, 
    task_duration, 
    is_completed, 
    due_date, 
    today, 
    sort_by, 
    order, 
    limit, 
    page)
  return jsonify(format_json_response(raw_tasks))

@app.route('/api/tasks', methods=['POST'])
def add_task():
  data = request.json
  errors = validate_task(data)
    
  if errors:
    return jsonify({ 'errors': errors }), 400
  
  title = str(data.get('title', '')).strip()
  description = str(data.get('description', '')).strip()
  category = str(data.get('category', 'General')).strip()
  due_date = data.get('dueDate')
  estimated_time = data.get('estimatedTime')

  task_id = create_tasks(title, description, category, due_date, estimated_time)

  return jsonify({
    "id" : task_id,
    "title": title,
    "description": description,
    "category": category,
    "isCompleted": False,
    "estimatedTime": estimated_time,
    "dueDate": due_date,
    "completedAt": None
  }), 201

@app.route('/api/tasks/<int:task_id>', methods=['PATCH'])
def edit_task(task_id):
  data = request.json  
  errors = validate_task(data, True)

  if errors:
    return jsonify({ 'errors': errors }), 400

  title = str(data.get('title', '')).strip()
  description = str(data.get('description', '')).strip()
  category = str(data.get('category', '')).strip()
  due_date = data.get('dueDate')
  estimated_time = data.get('estimatedTime')
  is_completed = data.get('isCompleted')  
  completed_at = data.get('completedAt')

  updated_result = update_task(
        task_id, 
        title=title, 
        category=category, 
        description=description, 
        estimated_time=estimated_time, 
        is_completed=is_completed, 
        due_date=due_date,
        completed_at=completed_at,
        has_completed_at="completedAt" in data
    )
  
  if updated_result is None:
    return jsonify({ "error": f"No task with the id {task_id} exists." }), 404

  return jsonify(format_json_response(updated_result)), 200

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete(task_id):
  deleted_id = delete_task(task_id)

  if deleted_id is not None:
    return jsonify({ "id" : deleted_id, "message": "Deleted successfully" }), 200

  return jsonify({ "error": f'No task with the id {task_id} exists.' }), 404

@app.route('/api/stats/productivity', methods=['GET'])
def fetch_productivity_data():
  data = get_productivity_trend()

  return jsonify(format_json_response(data))

@app.route('/api/stats/timespent', methods=['GET'])
def fetch_time_spent_data():
  data = get_time_spent()

  return jsonify(format_json_response(data))

@app.route('/api/stats/backloghealth', methods=["GET"])
def fetch_backlog_health():
  data = get_backlog_health()

  return jsonify(format_json_response(data))
  
if __name__ == "__main__":
    app.run(
        host=os.getenv('FLASK_RUN_HOST', '127.0.0.1'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        debug=True)