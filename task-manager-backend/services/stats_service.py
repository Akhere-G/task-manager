from db import get_db_connection
from datetime import datetime, timedelta
from services.task_service import with_repeating


def _get_productivity_trend(cursor, user_id):
    cursor.execute(
        """
        SELECT DATE(completed_at) as completed_at_date, COUNT(*) as completed_tasks, SUM(TIMESTAMPDIFF(MINUTE, start_at, end_at)) as time_spent
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
        SELECT category, SUM(TIMESTAMPDIFF(MINUTE, start_at, end_at)) as time_spent
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
                WHEN end_at < CURRENT_TIMESTAMP AND is_completed = 0 THEN 'Overdue'
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
            SUM(is_completed = 0 AND end_at < CURRENT_TIMESTAMP) AS overdue,
            SUM(is_completed = 0 AND end_at >= CURRENT_TIMESTAMP) AS pending
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
                WHEN DATEDIFF(CURRENT_TIMESTAMP, end_at) <= 3 THEN "< 3 Days"
                WHEN DATEDIFF(CURRENT_TIMESTAMP, end_at) <= 7 THEN "1 Week"
                WHEN DATEDIFF(CURRENT_TIMESTAMP, end_at) <= 30 THEN "1 Month"
                WHEN DATEDIFF(CURRENT_TIMESTAMP, end_at) <= 90 THEN "3 Months"
                ELSE "+3 Months"
            END as days_overdue,
            COUNT(*) as count
        FROM tasks
        WHERE user_id = %s AND is_completed = 0 AND end_at < CURRENT_TIMESTAMP 
        GROUP BY days_overdue
        ORDER BY MIN(DATEDIFF(CURRENT_TIMESTAMP, end_at)) ASC;
    """,
        (user_id,),
    )
    return cursor.fetchall()


def _get_deadline_proximity(cursor, user_id):
    cursor.execute(
        """
        SELECT category, AVG(DATEDIFF(end_at, CURRENT_TIMESTAMP)) as score
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


def _get_hourly_productivity(cursor, user_id):
    cursor.execute(
        """
        SELECT HOUR(completed_at) as hour, COUNT(*) as count
        FROM tasks
        WHERE is_completed = 1 AND user_id = %s
        GROUP BY hour
        ORDER BY hour;
        """,
        (user_id,),
    )

    raw_data = cursor.fetchall()

    hour_lookup = {row["hour"]: row["count"] for row in raw_data}

    hourly_productivity = []

    for i in range(24):
        if i not in hour_lookup:
            hour_lookup[i] = 0
        hourly_productivity.append({"hour": i, "count": hour_lookup[i]})

    return hourly_productivity


def _get_turnaround_time(cursor, user_id):
    cursor.execute(
        """
        SELECT DATEDIFF(completed_at, created_at) as days_taken, COUNT(*) as count
        FROM tasks
        WHERE is_completed = true 
            AND completed_at IS NOT NULL 
            AND created_at <= completed_at 
            AND user_id = %s
        GROUP BY days_taken
        ORDER BY days_taken ASC
        LIMIT 50;
        """,
        (user_id,),
    )

    raw_data = cursor.fetchall()
    if not raw_data:
        return []

    days_lookup = {d["days_taken"]: d["count"] for d in raw_data}

    max_days = raw_data[-1]["days_taken"]

    formatted_data = [
        {"days_taken": i, "count": days_lookup.get(i, 0)} for i in range(max_days + 1)
    ]

    return formatted_data


def _get_estimation_accuracy(cursor, user_id):
    cursor.execute(
        """
        SELECT 
            id,
            title,
            category,
            UNIX_TIMESTAMP(end_at) as estimated_at,
            UNIX_TIMESTAMP(completed_at) as completed_at,
            TIMESTAMPDIFF(MINUTE, completed_at, end_at) as variance_minutes
        FROM tasks
        WHERE user_id = %s 
            AND is_completed = 1 
            AND completed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY completed_at ASC;
        """,
        (user_id,),
    )

    data = cursor.fetchall()

    return data


"""
SELECT 
    DATE(end_at) AS date, 
    SUM(TIMESTAMPDIFF(MINUTE, start_at, end_at)) AS total_minutes,
    COUNT(*) AS count
FROM tasks
WHERE 
    user_id = %s 
    AND is_completed = 0 
    AND end_at >= CURDATE() 
    AND end_at < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date ASC;
"""


def _get_week_overview(cursor, user_id):
    # 1. Define the 7-day window
    view_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    view_end = view_start + timedelta(days=7)

    # 2. Fetch primary tasks
    cursor.execute(
        """
        SELECT * FROM tasks
        WHERE user_id = %s 
        AND is_completed = 0 
        AND end_at >= %s 
        AND end_at < %s
        ORDER BY end_at ASC;
        """,
        (user_id, view_start, view_end),
    )
    raw_data = cursor.fetchall()

    # 3. Use the updated with_repeating signature
    tasks = with_repeating(raw_data, view_start, view_end, user_id, cursor)

    date_lookup = {}

    for task in tasks:
        # Assuming end_at is already a datetime object from your DB cursor
        index = task["end_at"].date()

        # Calculate duration in minutes
        duration = (task["end_at"] - task["start_at"]).total_seconds() / 60.0

        if index in date_lookup:
            date_lookup[index]["count"] += 1
            date_lookup[index]["total_minutes"] += duration
        else:
            date_lookup[index] = {
                "count": 1,
                "total_minutes": duration,
            }

    # 4. Generate the final list
    return [
        {
            "date": d.strftime("%Y-%m-%d"),
            "totalMinutes": date_lookup[d]["total_minutes"],
            "total_hours": "{:.2f}".format(date_lookup[d]["total_minutes"] / 60),
            "count": date_lookup[d]["count"],
        }
        for d in sorted(date_lookup.keys())
    ]


def _get_distribution_trend(cursor, user_id):
    categories = [
        "work",
        "home",
        "chores",
        "life-admin",
        "health",
        "self-care",
        "social",
        "hobbies",
        "learning",
        "finance",
        "general",
    ]

    query = """
        SELECT DATE(completed_at) as date, category, COUNT(*) as count
        FROM tasks
        WHERE user_id = %s AND is_completed = 1 
        AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY date, category
    """
    cursor.execute(query, (user_id,))
    rows = cursor.fetchall()

    # Pre-fill map for the last 7 days
    results = {}
    for i in range(7):
        day = (datetime.now() - timedelta(days=i)).date().isoformat()
        results[day] = {cat: 0 for cat in categories}
        results[day]["date"] = day

    # Fill map using dictionary keys
    for row in rows:
        day_str = str(row["date"])
        cat = row["category"]
        count = row["count"]

        if day_str in results and cat in results[day_str]:
            results[day_str][cat] = count

    return sorted(results.values(), key=lambda x: x["date"])


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
            "deadlineProximity": _get_deadline_proximity(cursor, user_id),
            "hourlyProductivity": _get_hourly_productivity(cursor, user_id),
            "turnaround": _get_turnaround_time(cursor, user_id),
            "estimationAccuracy": _get_estimation_accuracy(cursor, user_id),
            "weekOverview": _get_week_overview(cursor, user_id),
            "distributionTrend": _get_distribution_trend(cursor, user_id),
        }
    except Exception as err:
        print(f"Database error: {err}")
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
