from app.database import db
from datetime import datetime, timedelta, timezone
from app.services.task_service import with_repeating
from app.constants import CATEGORIES
from app.models import Task
from app.utils.dates import as_aware_utc
from app.utils.serializers import task_to_dict


def _get_productivity_trend(tasks):
    trend_map = {}
    today = datetime.now(timezone.utc).date()

    for i in range(366):
        target_date = (today - timedelta(days=i)).isoformat()
        trend_map[target_date] = {"tasks": 0, "time_spent": 0}

    for t in tasks:
        if t["is_completed"] and t.get("completed_at"):
            c_date = t["completed_at"].date().isoformat()

            if c_date in trend_map:
                duration = (t["end_at"] - t["start_at"]).total_seconds() / 60.0

                trend_map[c_date]["tasks"] += 1
                trend_map[c_date]["time_spent"] += int(duration)

    return [
        {
            "date": date_str,
            "tasks": trend_map[date_str]["tasks"],
            "time_spent": trend_map[date_str]["time_spent"],
        }
        for date_str in sorted(trend_map.keys())
    ]


def _get_time_spent(tasks):
    time_map = {}

    for t in tasks:
        if t["is_completed"]:
            cat = t["category"]
            duration = (t["end_at"] - t["start_at"]).total_seconds() / 60.0

            if cat not in time_map:
                time_map[cat] = 0
            time_map[cat] += int(duration)

    result = [{"category": cat, "time_spent": time} for cat, time in time_map.items()]

    return sorted(result, key=lambda x: x["time_spent"], reverse=True)


def _get_backlog_health(tasks):
    counts = {"Completed": 0, "Overdue": 0, "Pending": 0}
    now = datetime.now(timezone.utc)
    for task in tasks:
        end_at = as_aware_utc(task["end_at"])
        if task["is_completed"]:
            counts["Completed"] += 1
        elif end_at < now:
            counts["Overdue"] += 1
        else:
            counts["Pending"] += 1

    return [{"status": k, "count": v} for k, v in counts.items()]


def _get_category_volume(tasks):
    volume_map = {}
    now = datetime.now(timezone.utc)

    for t in tasks:
        end_at = as_aware_utc(t["end_at"])

        cat = t["category"] or "General"
        if cat not in volume_map:
            volume_map[cat] = {"completed": 0, "overdue": 0, "pending": 0}

        if t["is_completed"]:
            volume_map[cat]["completed"] += 1
        elif end_at < now:
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

    now = datetime.now(timezone.utc)
    for t in tasks:
        end_at = as_aware_utc(t["end_at"])

        if not t["is_completed"] and end_at < now:
            days_diff = (now - end_at).days
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
    now = datetime.now(timezone.utc)

    for t in tasks:
        end_at = as_aware_utc(t["end_at"])

        if t["is_completed"]:
            continue

        cat = t["category"] or "General"
        if cat not in cat_data:
            cat_data[cat] = []

        diff = (end_at - now).total_seconds() / 86400.0
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
            hour = t["completed_at"].hour
            hour_lookup[hour] += 1

    return [{"hour": i, "count": hour_lookup[i]} for i in range(24)]


def _get_turnaround_time(tasks):
    days_lookup = {}
    max_days = 0

    for t in tasks:
        if t["is_completed"] and t.get("completed_at") and t.get("created_at"):
            diff = (t["completed_at"].date() - t["created_at"].date()).days

            if diff >= 0:
                days_lookup[diff] = days_lookup.get(diff, 0) + 1
                if diff > max_days:
                    max_days = diff

    return [
        {"days_taken": i, "count": days_lookup.get(i, 0)}
        for i in range(min(max_days + 1, 51))
    ]


def _get_estimation_accuracy(tasks):
    threshold_date = datetime.now(timezone.utc) - timedelta(days=30)

    accuracy_data = []
    for t in tasks:
        completed_at = (
            as_aware_utc(t["completed_at"])
            if t["completed_at"]
            else None
        )
        end_at = as_aware_utc(t["end_at"])

        if t["is_completed"] and completed_at and completed_at > threshold_date:
            variance = (end_at - completed_at).total_seconds() / 60.0

            accuracy_data.append(
                {
                    "id": t["id"],
                    "title": t["title"],
                    "category": t["category"],
                    "estimated_at": int(end_at.timestamp()),
                    "completed_at": int(completed_at.timestamp()),
                    "variance_minutes": int(variance),
                }
            )

    return sorted(accuracy_data, key=lambda x: x["completed_at"])


def _get_week_overview(tasks):
    date_lookup = {}

    view_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    view_end = view_start + timedelta(days=7)

    for task in tasks:
        if task["is_completed"]:
            continue

        task_end = as_aware_utc(task["end_at"])
        task_start = as_aware_utc(task["start_at"])

        if view_start <= task_end < view_end:
            index = task_end.date()
            duration = (task_end - task_start).total_seconds() / 60.0

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


def _get_distribution_trend(tasks):
    today = datetime.now(timezone.utc).date()
    results = {}

    for i in range(7):
        day = (today - timedelta(days=i)).isoformat()
        results[day] = dict.fromkeys(CATEGORIES, 0)
        results[day]["date"] = day

    for t in tasks:
        if t["is_completed"] and t.get("completed_at"):
            day_str = t["completed_at"].date().isoformat()
            cat = t.get("category") or "general"

            if day_str in results and cat in results[day_str]:
                results[day_str][cat] += 1

    return sorted(results.values(), key=lambda x: x["date"])


def _load_projected_tasks(user_id):
    tracked_tasks = (
        db.session.execute(db.select(Task).where(Task.user_id == user_id))
        .scalars()
        .all()
    )

    all_raw_tasks = [task_to_dict(t) for t in tracked_tasks]

    view_start = datetime.now(timezone.utc)
    view_end = view_start + timedelta(days=30)

    return with_repeating(all_raw_tasks, view_start, view_end, user_id)


def get_brief_stats(user_id):
    tasks = _load_projected_tasks(user_id)
    return {
        "productivity": _get_productivity_trend(tasks),
        "categoryVolume": _get_category_volume(tasks),
    }


def get_all_dashboard_stats(user_id):
    tasks = _load_projected_tasks(user_id)

    return {
        "productivity": _get_productivity_trend(tasks),
        "timeSpent": _get_time_spent(tasks),
        "backlogHealth": _get_backlog_health(tasks),
        "categoryVolume": _get_category_volume(tasks),
        "overdueDistribution": _get_overdue_distribution(tasks),
        "deadlineProximity": _get_deadline_proximity(tasks),
        "hourlyProductivity": _get_hourly_productivity(tasks),
        "turnaround": _get_turnaround_time(tasks),
        "estimationAccuracy": _get_estimation_accuracy(tasks),
        "weekOverview": _get_week_overview(tasks),
        "distributionTrend": _get_distribution_trend(tasks),
    }
