from db import get_db_connection
from datetime import datetime, timedelta

def get_productivity_trend(user_id, days=30):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DATE(completed_at) as completed_at_date, COUNT(*) as completed_tasks, SUM(estimated_time) as time_spent
            FROM tasks
            WHERE user_id = %s AND is_completed = 1 AND completed_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY completed_at_date;
        """, (user_id, days))
        
        raw_data = cursor.fetchall() 

        counts_lookup = {
            row['completed_at_date'].isoformat(): { 
                "completed_tasks" : row['completed_tasks'],
                "time_spent" : int(row['time_spent']) }
            for row in raw_data
        }
        
        trend_data = []
        for i in range(days, -1, -1):
            target_date = (datetime.now() - timedelta(days=i)).date()
            date_str = target_date.isoformat()
            
            trend_data.append({
                "date": date_str,
                "tasks": counts_lookup.get(date_str).get("completed_tasks") if counts_lookup.get(date_str) else 0,
                "time_spent": counts_lookup.get(date_str).get("time_spent") if counts_lookup.get(date_str) else 0,
            })
        
        return trend_data

    except Exception as err:
        raise err
    finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def get_time_spent(user_id):
    conn = None
    cursor = None
    try:
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
        return data
    
    except Exception as err:
        raise err
    finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def get_backlog_health(user_id):
    conn = None
    cursor = None
    try:
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

        return data
    except Exception as err:
        raise err
    finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def get_category_volume(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                category, 
                SUM(is_completed = 1) AS completed, 
                SUM(is_completed = 0 AND due_date < CURDATE()) AS overdue,
                SUM(is_completed = 0 AND due_date >= CURDATE()) AS pending
            FROM tasks
            WHERE user_id = %s
            GROUP BY category
            ORDER BY category DESC;
                    """, (user_id,))
        rawData = cursor.fetchall()

        data = [{ 
            "category": row["category"],
            "pending": int(row["pending"]),
            "completed": int(row["completed"]),
            "overdue": int(row["overdue"]),
            "total": int(row["pending"]) + int(row["completed"]) + int(row["overdue"]),

        } for row in rawData]

        return data
    except Exception as err:
        raise err
    finally:    
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def get_overdue_distribution(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql_query = """
        SELECT 
        CASE 
            WHEN DATEDIFF(CURDATE(), due_date) <= 3 THEN "< 3 Days"
            WHEN DATEDIFF(CURDATE(), due_date) <= 7 THEN "1 Week"
            WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN "1 Month"
            WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN "3 Months"
            ELSE "+3 Months"
        END as days_overdue,
        COUNT(*) as count,
        CASE 
            WHEN DATEDIFF(CURDATE(), due_date) <= 3 THEN 1
            WHEN DATEDIFF(CURDATE(), due_date) <= 7 THEN 2
            WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN 3
            WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN 4
            ELSE 5
        END as sort_order
        FROM tasks
        WHERE user_id = %s 
        AND is_completed = 0 
        AND due_date < CURDATE() 
        GROUP BY days_overdue, sort_order
        ORDER BY sort_order ASC;            
                    """
        
        cursor.execute(sql_query, (user_id,))
        data = cursor.fetchall()
        return data
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

