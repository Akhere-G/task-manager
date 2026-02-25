from db import get_db_connection
from datetime import datetime, timedelta


def _get_productivity_trend(cursor, user_id):
    cursor.execute(
        """
        SELECT DATE(completed_at) as completed_at_date, COUNT(*) as completed_tasks, SUM(estimated_time) as time_spent
        FROM tasks
        WHERE user_id = %s AND is_completed = 1 AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
        GROUP BY completed_at_date;
    """,
        (user_id,),
    )

    raw_data = cursor.fetchall()
    counts_lookup = {
        row["completed_at_date"].isoformat(): {
            "completed_tasks": row["completed_tasks"],
            "time_spent": int(row["time_spent"] or 0),
        }
        for row in raw_data
    }

    trend_data = []
    for i in range(365, -1, -1):
        target_date = (datetime.now() - timedelta(days=i)).date()
        date_str = target_date.isoformat()
        entry = counts_lookup.get(date_str, {"completed_tasks": 0, "time_spent": 0})
        trend_data.append(
            {
                "date": date_str,
                "tasks": entry["completed_tasks"],
                "time_spent": entry["time_spent"],
            }
        )
    return trend_data


def _get_time_spent(cursor, user_id):
    cursor.execute(
        """
        SELECT category, SUM(estimated_time) as time_spent
        FROM tasks
        WHERE user_id = %s AND is_completed = 1
        GROUP BY category
        ORDER BY time_spent DESC;
    """,
        (user_id,),
    )
    return [
        {"category": d["category"], "time_spent": int(d["time_spent"] or 0)}
        for d in cursor.fetchall()
    ]


def _get_backlog_health(cursor, user_id):
    cursor.execute(
        """
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
    """,
        (user_id,),
    )
    return cursor.fetchall()


def _get_category_volume(cursor, user_id):
    cursor.execute(
        """
        SELECT 
            category, 
            SUM(is_completed = 1) AS completed, 
            SUM(is_completed = 0 AND due_date < CURDATE()) AS overdue,
            SUM(is_completed = 0 AND due_date >= CURDATE()) AS pending
        FROM tasks
        WHERE user_id = %s
        GROUP BY category
        ORDER BY category DESC;
    """,
        (user_id,),
    )
    return [
        {
            "category": r["category"],
            "pending": int(r["pending"] or 0),
            "completed": int(r["completed"] or 0),
            "overdue": int(r["overdue"] or 0),
            "total": int(r["pending"] or 0)
            + int(r["completed"] or 0)
            + int(r["overdue"] or 0),
        }
        for r in cursor.fetchall()
    ]


def _get_overdue_distribution(cursor, user_id):
    cursor.execute(
        """
        SELECT 
            CASE 
                WHEN DATEDIFF(CURDATE(), due_date) <= 3 THEN "< 3 Days"
                WHEN DATEDIFF(CURDATE(), due_date) <= 7 THEN "1 Week"
                WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN "1 Month"
                WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN "3 Months"
                ELSE "+3 Months"
            END as days_overdue,
            COUNT(*) as count
        FROM tasks
        WHERE user_id = %s AND is_completed = 0 AND due_date < CURDATE() 
        GROUP BY days_overdue
        ORDER BY MIN(DATEDIFF(CURDATE(), due_date)) ASC;
    """,
        (user_id,),
    )
    return cursor.fetchall()


def _get_category_velocity(cursor, user_id):
    cursor.execute(
        """
        SELECT category, AVG(DATEDIFF(due_date, CURDATE())) as score
        FROM tasks
        WHERE user_id = %s AND is_completed = 0 
        GROUP BY category
        ORDER BY score DESC;
    """,
        (user_id,),
    )
    return [
        {"category": r["category"], "score": float(r["score"] or 0)}
        for r in cursor.fetchall()
    ]


def get_all_dashboard_stats(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        return {
            "productivity": _get_productivity_trend(cursor, user_id),
            "timeSpent": _get_time_spent(cursor, user_id),
            "backlogHealth": _get_backlog_health(cursor, user_id),
            "categoryVolume": _get_category_volume(cursor, user_id),
            "overdueDistribution": _get_overdue_distribution(cursor, user_id),
            "categoryVelocity": _get_category_velocity(cursor, user_id),
        }
    except Exception as err:
        print(f"Database error: {err}")
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
