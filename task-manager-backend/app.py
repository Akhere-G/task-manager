import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from services.task_service import get_all_tasks, create_tasks, update_task, delete_task
from utils.formatters import format_json_response
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
  category = request.args.get("category")

  raw_tasks = get_all_tasks(category)
  return jsonify(format_json_response(raw_tasks))

@app.route('/api/tasks', methods=['POST'])
def add_task():
  data = request.json
  title = data.get('title')
  description = data.get('description')
  category = data.get('category', 'General')
  due_date = data.get('dueDate')
  estimated_time = data.get('estimatedTime')

  errors = {}

  if not title:
    errors['title'] = "Title is required"
  elif len(title) > 255:
    errors['title'] = "Title must be less than 255 Characters"
  
  if not description:
    errors['description'] = "Description is required"
  
  if not due_date:
    errors['dueDate'] = "Due date is required"
  
  if estimated_time is None:
    errors['estimatedTime'] = "Estimated time is required"
  else: 
    try:
      estimated_time = int(estimated_time)
      if estimated_time < 1:
        errors['estimatedTime'] = "Estimated time must be more than 0"
    except (ValueError, TypeError):
      errors['estimatedTime'] = "Estimated time must be a number"
    
  if not category:
    errors['category'] = "Category is required"
  elif len(category) > 50:
    errors['category'] = "Category must be less than 50 Characters"

  if errors:
    return jsonify({ 'errors': errors }), 400
  
  task_id = create_tasks(title, description, category, due_date, estimated_time)

  return jsonify({
    "id" : task_id,
    "title": title,
    "description": description,
    "category": category,
    "isCompleted": False,
    "estimatedTime": estimated_time,
    "dueDate": due_date
  }), 201

@app.route('/api/tasks/<int:task_id>', methods=['PATCH'])
def edit_task(task_id):
  task = request.json

  title = task.get('title')
  category = task.get('category')
  description  = task.get('description')  
  estimated_time = task.get('estimatedTime')   
  is_completed = task.get('isCompleted')  
  due_date = task.get('dueDate')
  
  errors = {}

  if title and len(title) > 255:
    errors['title'] = "Title must be less than 255 Characters"

  if category and len(category) > 50:
    errors['category'] = "Category must be less than 255 Characters"

  if estimated_time is not None:
    try:
      estimated_time = int(estimated_time)
      if estimated_time < 1:
        errors['estimatedTime'] = "Estimated time must be more than 0"
    except (ValueError, TypeError):
      errors['estimatedTime'] = "Estimated time must be a number"

  if errors:
    return jsonify({ 'errors': errors }), 400

  updated_result = update_task(
        task_id, 
        title=title, 
        category=category, 
        description=description, 
        estimated_time=estimated_time, 
        is_completed=is_completed, 
        due_date=due_date
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


if __name__ == "__main__":
    app.run(
        host=os.getenv('FLASK_RUN_HOST', '127.0.0.1'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        debug=True)