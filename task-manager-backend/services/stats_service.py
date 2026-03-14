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


def _get_backlog_health(tasks):
    counts = {"Completed": 0, "Overdue": 0, "Pending": 0}
    now = datetime.now()

    for task in tasks:
        if task["is_completed"]:
            counts["Completed"] += 1
        elif task["end_at"] < now:
            counts["Overdue"] += 1
        else:
            counts["Pending"] += 1

    return [{"status": k, "count": v} for k, v in counts.items()]


def _get_category_volume(tasks):
    volume_map = {}
    now = datetime.now()

    for t in tasks:
        cat = t["category"] or "General"
        if cat not in volume_map:
            volume_map[cat] = {"completed": 0, "overdue": 0, "pending": 0}

        if t["is_completed"]:
            volume_map[cat]["completed"] += 1
        elif t["end_at"] < now:
            volume_map[cat]["overdue"] += 1
        else:
            volume_map[cat]["pending"] += 1

    result = [
        {
            "category": cat,
            "pending": data["pending"],
            "completed": data["completed"],
            "overdue": data["overdue"],
            "total": data["pending"] + data["completed"] + data["overdue"],
        }
        for cat, data in volume_map.items()
    ]

    return sorted(result, key=lambda x: x["category"], reverse=True)


def _get_overdue_distribution(tasks):
    distribution = {
        "< 3 Days": 0,
        "1 Week": 0,
        "1 Month": 0,
        "3 Months": 0,
        "+3 Months": 0,
    }

    now = datetime.now()
    for t in tasks:
        # Only process overdue tasks that are not completed
        if not t["is_completed"] and t["end_at"] < now:
            days_diff = (now - t["end_at"]).days
            if days_diff <= 3:
                distribution["< 3 Days"] += 1
            elif days_diff <= 7:
                distribution["1 Week"] += 1
            elif days_diff <= 30:
                distribution["1 Month"] += 1
            elif days_diff <= 90:
                distribution["3 Months"] += 1
            else:
                distribution["+3 Months"] += 1

    return [{"days_overdue": k, "count": v} for k, v in distribution.items() if v > 0]


def _get_deadline_proximity(tasks):
    cat_data = {}
    now = datetime.now()

    for t in tasks:
        # Only consider pending tasks for deadline proximity
        if t["is_completed"]:
            continue

        cat = t["category"] or "General"
        if cat not in cat_data:
            cat_data[cat] = []

        diff = (t["end_at"] - now).total_seconds() / 86400.0
        cat_data[cat].append(diff)

    results = [
        {"category": cat, "score": float(sum(diffs) / len(diffs))}
        for cat, diffs in cat_data.items()
    ]

    return sorted(results, key=lambda x: x["score"], reverse=True)


def _get_hourly_productivity(tasks):
    hour_lookup = {i: 0 for i in range(24)}

    for t in tasks:
        if t["is_completed"] and t.get("completed_at"):
            # Ensure completed_at is a datetime object
            hour = t["completed_at"].hour
            hour_lookup[hour] += 1

    return [{"hour": i, "count": hour_lookup[i]} for i in range(24)]


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


def _get_week_overview(tasks):
    date_lookup = {}

    view_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    view_end = view_start + timedelta(days=7)

    for task in tasks:
        # Only include pending tasks for the upcoming week overview
        if task["is_completed"]:
            continue

        task_end = task["end_at"]
        if view_start <= task_end < view_end:
            index = task_end.date()
            duration = (task_end - (task["start_at"])).total_seconds() / 60.0

            if index in date_lookup:
                date_lookup[index]["count"] += 1
                date_lookup[index]["total_minutes"] += duration
            else:
                date_lookup[index] = {
                    "count": 1,
                    "total_minutes": duration,
                }

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

        cursor.execute("SELECT * FROM tasks WHERE user_id = %s", (user_id,))
        all_raw_tasks = cursor.fetchall()

        view_start = datetime.now()
        view_end = view_start + timedelta(days=30)
        tasks = with_repeating(all_raw_tasks, view_start, view_end, user_id, cursor)

        return {
            "productivity": _get_productivity_trend(cursor, user_id),
            "timeSpent": _get_time_spent(cursor, user_id),
            "backlogHealth": _get_backlog_health(tasks),
            "categoryVolume": _get_category_volume(tasks),
            "overdueDistribution": _get_overdue_distribution(tasks),
            "deadlineProximity": _get_deadline_proximity(tasks),
            "hourlyProductivity": _get_hourly_productivity(tasks),
            "turnaround": _get_turnaround_time(cursor, user_id),
            "estimationAccuracy": _get_estimation_accuracy(cursor, user_id),
            "weekOverview": _get_week_overview(tasks),
            "distributionTrend": _get_distribution_trend(cursor, user_id),
        }
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
