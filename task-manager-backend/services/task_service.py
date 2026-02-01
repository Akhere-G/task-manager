from db import get_db_connection
from utils.formatters import format_json_response

def get_all_tasks():
  conn = get_db_connection()
  cursor = conn.cursor(dictionary=True)
  cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
  tasks = cursor.fetchall()

  cursor.close()
  conn.close()
  return tasks

def create_tasks(title, description, category, due_date, estimated_time):
  conn = get_db_connection()
  cursor = conn.cursor()
  cursor.execute("INSERT INTO tasks (title, description, category, due_date, estimated_time) VALUES (%s, %s, %s, %s, %s);",
                  (title, description, category, due_date, estimated_time))
  conn.commit()
  new_id = cursor.lastrowid
  cursor.close()
  conn.close()
  return new_id

def update_task(id, title=None, description=None, category=None, due_date=None, estimated_time=None, is_completed=None):
  conn = get_db_connection()
  cursor = conn.cursor(dictionary=True)

  cursor.execute("SELECT * FROM tasks WHERE id = %s", (id,))
  task = cursor.fetchone()

  if task is None:
    cursor.close()
    conn.close()
    return None
  
  updated_title = title if title is not None else task['title']
  updated_desc = description if description is not None else task['description']
  updated_cat = category if category is not None else task['category']
  updated_due = due_date if due_date is not None else task['due_date']
  updated_time = estimated_time if estimated_time is not None else task['estimated_time']
  updated_status = is_completed if is_completed is not None else task['is_completed']
  
  cursor.execute("""
        UPDATE tasks 
        SET title = %s, description = %s, category = %s, due_date = %s, estimated_time = %s, is_completed = %s
        WHERE id = %s
    """, (updated_title, updated_desc, updated_cat, updated_due, updated_time, int(updated_status), id))
  
  conn.commit()
  cursor.close()
  conn.close()

  return {
        "id": id,
        "title": updated_title,
        "description": updated_desc,
        "category": updated_cat,
        "due_date": updated_due,
        "estimated_time": updated_time,
        "is_completed": updated_status,
        "created_at": task.get("created_at")
  }
  
def delete_task(id):
  conn = get_db_connection()
  cursor = conn.cursor()

  cursor.execute("DELETE FROM tasks WHERE id = %s", (id,))
  deleted_rows = cursor.rowcount

  cursor.close()
  conn.close()
  return id if deleted_rows > 0 else None