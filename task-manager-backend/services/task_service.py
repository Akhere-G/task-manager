from db import get_db_connection
from utils.formatters import format_json_response
from datetime import date

def get_all_tasks(user_id, category=None, search=None, task_duration=None, is_completed=None, due_date=None, today=None, sort_by=None, order=None, limit=None, page=None):
  conn = None
  cursor = None
  try:
    SHORT_TASK_THRESHOLD = 30
    if today is None:
      today = date.today()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    params = [user_id]
    base_filters = " WHERE user_id = %s"
    
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

    count_query = f"SELECT COUNT(*) as total FROM tasks{base_filters}"
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()['total']

    SORTABLE_FIELDS = ["created_at", "title", "due_date", "estimated_time"]
    sort_by_field = sort_by if sort_by in SORTABLE_FIELDS else "created_at"
    order_value = "ASC" if order == "asc" else "DESC"
    
    data_query = f"SELECT * FROM tasks{base_filters} ORDER BY {sort_by_field} {order_value}"
    if page is not None and limit is not None:
      page = max(int(page), 1)
      limit = max(int(limit), 1)
      offset = limit * (page - 1)
      data_query += " LIMIT %s OFFSET %s"
      params.extend([limit, offset])
    else:
      page = 1
      offset = 0
      limit = total_count if total_count > 0 else 1
    
    cursor.execute(data_query, params)
    tasks = cursor.fetchall()

    for task in tasks:
      task["is_completed"] = True if task["is_completed"] == 1 else False
    # 4. Return both the tasks and pagination info
    return {
      "tasks": tasks,
      "total_tasks": total_count,
      "total_pages": (total_count + int(limit) - 1) // int(limit),
      "current_page": int(page)
    }
  except Exception as err:
        raise err
  finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def create_tasks(user_id, title, description, category, due_date, estimated_time):
  conn = None
  cursor = None  
  try:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (title, description, category, due_date, estimated_time, user_id) VALUES (%s, %s, %s, %s, %s, %s);",
                    (title, description, category, due_date, estimated_time, user_id))
    conn.commit()
    new_id = cursor.lastrowid
    return new_id
  except Exception as err:
        raise err
  finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()  

def update_task(user_id, id, title=None, description=None, category=None, due_date=None, estimated_time=None, is_completed=None, completed_at=None, has_completed_at=False):
  conn = None
  cursor = None
  try:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM tasks WHERE id = %s and user_id = %s", (id, user_id))
    task = cursor.fetchone()

    if task is None:
      return None
    
    updated_title = title if title else task['title']
    updated_desc = description if description else task['description']
    updated_cat = category if category else task['category']
    updated_due = due_date if due_date else task['due_date']
    updated_time = estimated_time if estimated_time else task['estimated_time']
    updated_status = is_completed if is_completed is not None else task['is_completed']
    updated_completed_at = completed_at if has_completed_at else task['completed_at']
    
    cursor.execute("""
          UPDATE tasks 
          SET title = %s, description = %s, category = %s, due_date = %s, estimated_time = %s, is_completed = %s, completed_at = %s
          WHERE id = %s and user_id = %s
      """, (updated_title, updated_desc, updated_cat, updated_due, updated_time, int(updated_status), updated_completed_at, id, user_id))
    
    conn.commit()

    return {
          "id": id,
          "title": updated_title,
          "description": updated_desc,
          "category": updated_cat,
          "due_date": updated_due,
          "estimated_time": updated_time,
          "is_completed": True if updated_status == 1 else False,
          "created_at": task.get("created_at"),
          "completed_at": updated_completed_at
    }
  except Exception as err:
        raise err
  finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()  
  
def delete_task(user_id, task_id):
  conn = None
  cursor = None
  try:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM tasks WHERE user_id = %s AND id = %s ", (user_id, task_id))
    deleted_rows = cursor.rowcount

    conn.commit()
    return task_id if deleted_rows > 0 else None
  except Exception as err:
        raise err
  finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()  