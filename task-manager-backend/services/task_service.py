from db import get_db_connection
from utils.formatters import format_json_response
from datetime import date

def get_all_tasks(category=None, search=None, task_duration=None, is_completed=None, due_date=None, today=None, sort_by=None, order=None, limit=10, page=1):
  SHORT_TASK_THRESHOLD = 30
  if today is None:
    today = date.today()

  conn = get_db_connection()
  cursor = conn.cursor(dictionary=True)
  
  # 1. Build the base query (without SELECT *)
  params = []
  base_filters = " WHERE 1=1"
  
  if category and category != "all":
    base_filters += " AND category = %s"
    params.append(category)

  if search:
    base_filters += " AND MATCH(title, description) AGAINST(%s IN BOOLEAN MODE)"
    params.append(f"{search}*")

  if is_completed is not None and is_completed != "all":
    is_completed_val = 1 if str(is_completed).lower() == "true" else 0 
    base_filters += " AND is_completed = %s"
    params.append(is_completed_val)

  if due_date:
    if due_date == "today":
      base_filters += " AND due_date = %s"
      params.append(today)
    if due_date == "this_week":
      base_filters += " AND due_date BETWEEN %s AND DATE_ADD(%s, INTERVAL 7 DAY)"
      params.extend([today, today])
    if due_date == "this_month":
      base_filters += " AND due_date BETWEEN %s AND DATE_ADD(%s, INTERVAL 30 DAY)"
      params.extend([today, today])
    if due_date == "overdue":
      base_filters += " AND due_date < %s AND is_completed = 0"
      params.append(today)

  if task_duration:
    if task_duration == "short_tasks":
      base_filters += " AND estimated_time <= %s"
      params.append(SHORT_TASK_THRESHOLD)
    elif task_duration == "long_tasks":
      base_filters += " AND estimated_time > %s" 
      params.append(SHORT_TASK_THRESHOLD)

  # 2. Get the TOTAL COUNT for these filters
  count_query = f"SELECT COUNT(*) as total FROM tasks{base_filters}"
  cursor.execute(count_query, params)
  total_count = cursor.fetchone()['total']

  # 3. Get the ACTUAL DATA with sorting and pagination
  SORTABLE_FIELDS = ["created_at", "title", "due_date", "estimated_time"]
  sort_by_field = sort_by if sort_by in SORTABLE_FIELDS else "created_at"
  order_value = "ASC" if order == "asc" else "DESC"
  
  offset = int(limit) * (int(page) - 1)
  data_query = f"SELECT * FROM tasks{base_filters} ORDER BY {sort_by_field} {order_value} LIMIT %s OFFSET %s"
  
  # Add pagination params to a copy of params
  data_params = params + [int(limit), offset]
  
  cursor.execute(data_query, data_params)
  tasks = cursor.fetchall()

  cursor.close()
  conn.close()

  # 4. Return both the tasks and pagination info
  return {
    "tasks": tasks,
    "total_tasks": total_count,
    "total_pages": (total_count + int(limit) - 1) // int(limit),
    "current_page": int(page)
  }

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