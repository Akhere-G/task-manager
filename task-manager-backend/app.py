from flask import Flask, jsonify, request
from flask_cors import CORS
from services.task_service import get_all_tasks, create_tasks
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
  tasks = get_all_tasks()
  return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
  data = request.json
  title = data.get('title')
  description = data.get('description')
  category = data.get('category', 'General')
  due_date = data.get('dueDate')
  estimated_time = data.get('estimatedTime')

  if not title:
    return jsonify({ 'error': "Title is required" }), 400
  
  if not description:
    return jsonify({ 'error': "Description is required" }), 400
  
  if not due_date:
    return jsonify({ 'error': "Due date is required" }), 400
  
  if not estimated_time:
    return jsonify({ 'error': "Estimated time is required" }), 400
  
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
  
if __name__ == "__main__":
    app.run(
        host=os.getenv('FLASK_RUN_HOST', '127.0.0.1'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        debug=True)