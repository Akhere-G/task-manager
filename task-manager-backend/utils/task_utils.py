from datetime import timedelta, datetime, date
from dateutil.relativedelta import relativedelta


def build_task_filters(
    user_id,
    category=None,
    search=None,
    is_completed=None,
    start_date=None,
    end_date=None,
    duration=None,
):
    """Helper to build query strings and parameters dynamically."""
    params = [user_id]
    filters = ["user_id = %s"]

    if category and category != "all":
        filters.append("category = %s")
        params.append(category)

    if search:
        filters.append("MATCH(title, description) AGAINST(%s IN BOOLEAN MODE)")
        params.append(f"{search}*")

    if is_completed is not None and is_completed != "all":
        filters.append("is_completed = %s")
        params.append(1 if str(is_completed).lower() == "true" else 0)

    if start_date and end_date:
        filters.append("end_at BETWEEN %s AND %s")
        params.extend([f"{start_date} 00:00:00", f"{end_date} 23:59:59"])
    # Duration filters
    if duration in ["short_tasks", "long_tasks"]:
        op = "<=" if duration == "short_tasks" else ">"
        filters.append(f"TIMESTAMPDIFF(MINUTE, start_at, end_at) {op} 30")

    return " WHERE " + " AND ".join(filters), params


def with_repeating(
    tasks,
    view_start,
    view_end,
    user_id,
    cursor,
    base_filters="WHERE user_id = %s",
    params=None,
):

    if not params:
        params = [user_id]

    cursor.execute(
        f"""
        SELECT * FROM tasks 
        {base_filters}
        AND is_repeating = 1
        AND (repeat_until IS NULL OR repeat_until >= %s);
    """,
        params + [view_start],
    )
    repeating_tasks = cursor.fetchall()

    for task in repeating_tasks:
        # Start checking from the original task date
        instance_start = task["start_at"]
        instance_end = task["end_at"]
        repeat_until = task.get("repeat_until")

        if repeat_until and isinstance(repeat_until, date):
            repeat_until = datetime.combine(repeat_until, datetime.max.time())
        if not repeat_until:
            repeat_until = view_end

        # Advance instance until it hits or passes the start of the view
        while instance_start < view_start:
            instance_start = update_date(instance_start, task["repeat_by"])
            instance_end = update_date(instance_end, task["repeat_by"])

            # Stop if we passed the repeat_until limit
            if repeat_until and instance_start >= repeat_until:
                break

        # Now generate all instances that fall within the view_end
        if task["start_at"] == instance_start:
            instance_start = update_date(instance_start, task["repeat_by"])
            instance_end = update_date(instance_end, task["repeat_by"])

        while instance_start <= view_end:
            # Check the repeat_until limit again

            if repeat_until and instance_start > repeat_until:
                break

            ghost_task = task.copy()
            ghost_task.update(
                {
                    "start_at": instance_start,
                    "end_at": instance_end,
                    "is_ghost": True,
                    "id": f"ghost_{task['id']}_{instance_start.strftime('%Y%m%d')}",
                    "series_id": task["id"],
                }
            )
            tasks.append(ghost_task)

            # Next iteration
            instance_start = update_date(instance_start, task["repeat_by"])
            instance_end = update_date(instance_end, task["repeat_by"])

    return tasks


def check_should_repeat(old_task, updated_task):
    if (
        updated_task["is_repeating"]
        and updated_task["is_completed"]
        and not old_task["is_completed"]
    ):
        repeat_until_val = updated_task["repeat_until"]

        if isinstance(repeat_until_val, str):
            repeat_until_val = datetime.strptime(
                updated_task["repeat_until"], "%Y-%m-%d"
            ).date()
        if isinstance(repeat_until_val, date):
            repeat_until_val = datetime.combine(repeat_until_val, datetime.max.time())

        start_at = updated_task["start_at"]

        if isinstance(start_at, str):
            start_at = datetime.strptime(start_at, "%Y-%m-%d %H:%M")

        next_start = update_date(start_at, updated_task["repeat_by"])

        is_within_limit = not repeat_until_val or repeat_until_val >= next_start
        return is_within_limit
    return False


def handle_repeat_task(cursor, user_id, original_task):
    cursor.execute(
        """INSERT INTO tasks (title, description, category, start_at, end_at, 
           is_repeating, user_id, series_id, is_completed, completed_at, created_at) 
           VALUES (%s, %s, %s, %s, %s, 0, %s, %s, 1, %s, %s)""",
        (
            original_task["title"],
            original_task["description"],
            original_task["category"],
            original_task["start_at"],
            original_task["end_at"],
            user_id,
            original_task["id"],
            original_task["completed_at"] or date.today(),
            original_task["created_at"],
        ),
    )

    next_start = update_date(original_task["start_at"], original_task["repeat_by"])
    next_end = update_date(original_task["end_at"], original_task["repeat_by"])

    cursor.execute(
        """UPDATE tasks 
           SET start_at = %s, end_at = %s, is_completed = 0, completed_at = NULL, series_id = id, created_at = %s 
           WHERE id = %s""",
        (next_start, next_end, datetime.now(), original_task["id"]),
    )


def update_date(old_date, repeat_by):
    if repeat_by == "daily":
        return old_date + timedelta(days=1)
    if repeat_by == "weekly":
        return old_date + timedelta(weeks=1)
    if repeat_by == "monthly":
        return old_date + relativedelta(months=1)
    if repeat_by == "yearly":
        return old_date + relativedelta(years=1)
    return old_date + timedelta(days=1)
