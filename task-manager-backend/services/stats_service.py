from db import get_db_connection
from datetime import datetime, timedelta

def get_productivity_trend(user_id, days=30):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT DATE(completed_at) as completed_at_date, COUNT(*) as completed_tasks
        FROM tasks
        WHERE user_id = %s AND is_completed = 1 AND completed_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        GROUP BY completed_at_date;
    """, (user_id, days))
    
    raw_data = cursor.fetchall() 
    cursor.close()
    conn.close()

    counts_lookup = {
        row['completed_at_date'].isoformat(): row['completed_tasks'] 
        for row in raw_data
    }
    
    trend_data = []
    for i in range(days, -1, -1):
        target_date = (datetime.now() - timedelta(days=i)).date()
        date_str = target_date.isoformat()
        
        trend_data.append({
            "date": date_str,
            "tasks": counts_lookup.get(date_str, 0) 
        })
    
    return trend_data

def get_time_spent(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT category, SUM(estimated_time) as time_spent
        FROM tasks
        WHERE user_id = %s AND is_completed = 1
        GROUP BY category
        ORDER BY time_spent DESC;
                """, (user_id,))
    data = cursor.fetchall()
    data = [{ "category": d["category"], "time_spent" : int(d["time_spent"]) } for d in data]
    cursor.close()
    conn.close()
    return data

def get_backlog_health(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            CASE 
                WHEN is_completed = 1 THEN 'Completed'
                WHEN due_date < CURDATE() AND is_completed = 0 THEN 'Overdue'
                ELSE 'Pending'
            END as status,
            COUNT(*) as count
        FROM tasks
        WHERE user_id = %s
        GROUP BY status;
                    """, (user_id,))
    
    data = cursor.fetchall()
    cursor.close()
    conn.close()

    return data

def get_category_volume(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT category, COUNT(*) as count
        FROM tasks
        WHERE user_id = %s AND is_completed = 0
        GROUP BY category
        ORDER BY count;
                """, (user_id,))
    data = cursor.fetchall()
    cursor.close()
    conn.close()

    return data