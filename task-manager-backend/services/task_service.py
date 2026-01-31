from db import get_db_connection

def get_all_tasks():
  conn = get_db_connection()
  cursor = conn.cursor(dictionary=True)
  cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
  rows = cursor.fetchall()

  tasks = []
  for row in rows:
    tasks.append({
      'id': row['id'],
      'title': row['title'],
      'description': row['description'],
      'category': row['category'],
      'isCompleted': bool(row['is_completed']),
      'dueDate': str(row['due_date']),
      'estimatedTime': row['estimated_time'],
      'createdAt': row['created_at'].isoformat(),
    })

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