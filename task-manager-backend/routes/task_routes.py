from flask import Blueprint, request, jsonify
from utils.formatters import format_json_response
from utils.validators import validate_task
from services.task_service import get_all_tasks, create_tasks, update_task, delete_task
from flask_jwt_extended import jwt_required, get_jwt_identity

task_bp = Blueprint("tasks", __name__)

@task_bp.route('/api/tasks', methods=['GET'])
@jwt_required()
def list_tasks():
  user_id = get_jwt_identity()
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
    user_id,
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

@task_bp.route('/api/tasks', methods=['POST'])
@jwt_required()
def add_task():
  user_id = get_jwt_identity()
  data = request.json
  errors = validate_task(data)
    
  if errors:
    return jsonify({ 'errors': errors }), 400
  
  title = str(data.get('title', '')).strip()
  description = str(data.get('description', '')).strip()
  category = str(data.get('category', 'General')).strip()
  due_date = data.get('dueDate')
  estimated_time = data.get('estimatedTime')

  task_id = create_tasks(user_id, title, description, category, due_date, estimated_time)

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

@task_bp.route('/api/tasks/<int:task_id>', methods=['PATCH'])
@jwt_required()
def edit_task(task_id):
  user_id = get_jwt_identity()
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
        user_id,
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

@task_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete(task_id):
  user_id = get_jwt_identity()
  deleted_id = delete_task(user_id, task_id)

  if deleted_id is not None:
    return jsonify({ "id" : deleted_id, "message": "Deleted successfully" }), 200

  return jsonify({ "error": f'No task with the id {task_id} exists.' }), 404

