from db import get_db_connection
from datetime import datetime, timedelta

def get_productivity_trend():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT DATE(completed_at) as completed_at_date, COUNT(*) as completed_tasks
        FROM tasks
        WHERE is_completed = 1 AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY completed_at_date;
    """)
    
    raw_data = cursor.fetchall() 
    cursor.close()
    conn.close()

    counts_lookup = {
        row['completed_at_date'].isoformat(): row['completed_tasks'] 
        for row in raw_data
    }
    
    trend_data = []
    for i in range(30, -1, -1):
        target_date = (datetime.now() - timedelta(days=i)).date()
        date_str = target_date.isoformat()
        
        trend_data.append({
            "date": date_str,
            "tasks": counts_lookup.get(date_str, 0) 
        })
    
    return trend_data

def get_time_spent():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT category, SUM(estimated_time) as time_spent
        FROM tasks
        WHERE is_completed = 1
        GROUP BY category
        ORDER BY time_spent DESC;
                """)
    data = cursor.fetchall()
    cursor.close()
    conn.close()
    return data

def get_backlog_health():
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
        GROUP BY status;
                    """)
    
    data = cursor.fetchall()
    cursor.close()
    conn.close()

    return data

def get_category_volume():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT category, COUNT(*) as count
        FROM tasks
        WHERE is_completed = 0
        GROUP BY category
        ORDER BY count;
                """)
    data = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return data