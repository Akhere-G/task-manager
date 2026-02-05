from db import get_db_connection
from utils.formatters import format_json_response
from datetime import date

def get_all_tasks(category=None, search=None, task_duration=None, is_completed=None, due_date=None, today=None):
  SHORT_TASK_THRESHOLD = 30

  if today == None:
    today = date.today()

  conn = get_db_connection()
  cursor = conn.cursor(dictionary=True)
  params = []
  sql_query = """
                SELECT * FROM tasks
                WHERE 1=1 
              """
  
  if category and category != "all":
    sql_query += " AND category = %s"
    params.append(category)

  if search:
    search_param = f"{search}*"
    sql_query += " AND MATCH(title, description) AGAINST(%s IN BOOLEAN MODE)"
    params.append(search_param)

  if is_completed is not None and is_completed != "all":
    is_completed = 1 if str(is_completed).lower() == "true" else 0 
    sql_query += " AND is_completed = %s"
    params.append(is_completed)

  if due_date:
    if due_date == "today":
      sql_query += " AND due_date = %s"
      params.append(today)
    if due_date == "this_week":
      sql_query += " AND due_date BETWEEN %s AND DATE_ADD(%s, INTERVAL 7 DAY)"
      params.extend([today, today])
    if due_date == "this_month":
      sql_query += " AND due_date BETWEEN %s AND DATE_ADD(%s, INTERVAL 30 DAY)"
      params.extend([today, today])
    if due_date == "overdue":
      sql_query += " AND due_date < %s AND is_completed = 0"
      params.append(today)

  if task_duration:
    if task_duration == "short_tasks":
      sql_query += " AND estimated_time <= %s"
      params.append(SHORT_TASK_THRESHOLD)
    elif task_duration == "long_tasks":
      sql_query += " AND estimated_time > %s" 
      params.append(SHORT_TASK_THRESHOLD)
  
  sql_query += " ORDER BY created_at DESC;"

  cursor.execute(sql_query, params)
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
  
  updated_title = title if title else task['title']
  updated_desc = description if description  else task['description']
  updated_cat = category if category else task['category']
  updated_due = due_date if due_date else task['due_date']
  updated_time = estimated_time if estimated_time else task['estimated_time']
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