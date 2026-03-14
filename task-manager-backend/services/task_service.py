from db import get_db_connection
from datetime import timedelta, datetime, date
from dateutil.relativedelta import relativedelta
import calendar


def _build_task_filters(
    user_id, category, search, is_completed, start_date, end_date, duration
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


def get_all_tasks(
    user_id,
    category=None,
    search=None,
    duration=None,
    is_completed=None,
    start_date=None,
    end_date=None,
    current_date=None,
    sort_by=None,
    order=None,
    limit=None,
    page=None,
    project_repeating=False,
):

    conn = None
    cursor = None
    try:
        base_filters, params = _build_task_filters(
            user_id, category, search, is_completed, start_date, end_date, duration
        )

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Execute Count
        cursor.execute(f"SELECT COUNT(*) as total FROM tasks {base_filters}", params)
        total_count = cursor.fetchone()["total"]

        # Sort Logic
        sort_map = {
            "created_at": "created_at",
            "title": "title",
            "start_at": "start_at",
            "duration": "TIMESTAMPDIFF(MINUTE, start_at, end_at)",
        }
        sort_by_field = sort_map.get(sort_by, "created_at")
        order_dir = "ASC" if order == "asc" else "DESC"

        # Paginate
        if page is not None:
            page = int(page)
            if page < 1:
                page = 1
        else:
            page = 1

        # Handle the limit
        if limit is not None:
            limit = int(limit)
            if limit < 1:
                limit = 1
        else:
            # Fallback to total_count, or at least 1 if empty
            limit = total_count if total_count > 0 else 1
        offset = limit * (page - 1)

        query = f"SELECT * FROM tasks {base_filters} ORDER BY {sort_by_field} {order_dir} LIMIT %s OFFSET %s"
        cursor.execute(query, params + [limit, offset])

        tasks = cursor.fetchall()

        if project_repeating:
            with_repeating(tasks, current_date, user_id, cursor)
            total_count = len(tasks)

        tasks = [
            {
                **t,
                "is_completed": bool(t["is_completed"]),
                "is_repeating": bool(t["is_repeating"]),
            }
            for t in tasks
        ]

        return {
            "tasks": tasks,
            "total_tasks": total_count,
            "total_pages": (total_count + limit - 1) // limit,
            "current_page": page,
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def with_repeating(tasks, current_date, user_id, cursor):
    cursor.execute(
        """
        SELECT * FROM tasks 
        WHERE user_id = %s AND is_repeating = 1 AND repeat_until > %s
    """,
        (user_id, current_date),
    )
    repeating_tasks = cursor.fetchall()

    curr = datetime.strptime(current_date, "%Y-%m-%d")
    view_start = curr.replace(day=1)
    last_day = calendar.monthrange(curr.year, curr.month)[1]
    view_end = curr.replace(day=last_day, hour=23, minute=59, second=59)

    for task in repeating_tasks:
        # Start checking from the original task date
        instance_start = task["start_at"]
        instance_end = task["end_at"]
        repeat_until = task.get("repeat_until")

        if repeat_until and isinstance(repeat_until, date):
            repeat_until = datetime.combine(repeat_until, datetime.max.time())

        # Advance instance until it hits or passes the start of the view
        while instance_start < view_start:
            instance_start = update_date(instance_start, task["repeat_by"])
            instance_end = update_date(instance_end, task["repeat_by"])

            # Stop if we passed the repeat_until limit
            if repeat_until and instance_start >= repeat_until:
                break

        # Now generate all instances that fall within the view_end
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
                }
            )
            tasks.append(ghost_task)

            # Next iteration
            instance_start = update_date(instance_start, task["repeat_by"])
            instance_end = update_date(instance_end, task["repeat_by"])

    return tasks


def get_task(user_id, task_id):
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql = "SELECT * FROM tasks WHERE user_id = %s AND id = %s"
        cursor.execute(sql, (user_id, task_id))
        task = cursor.fetchone()
        task["is_completed"] = True if task["is_completed"] == 1 else False
        task["is_repeating"] = True if task["is_repeating"] == 1 else False

        return task

    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def create_task(user_id, data):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO tasks (title, description, category, start_at, end_at, 
               is_repeating, repeat_by, repeat_until, user_id) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                data.get("title", "").strip(),
                (data.get("description").strip() if data.get("description") else None),
                str(data.get("category", "General")).strip(),
                data.get("startAt"),
                data.get("endAt"),
                1 if data.get("isRepeating") else 0,
                data.get("repeatBy"),
                data.get("repeatUntil"),
                user_id,
            ),
        )
        new_id = cursor.lastrowid

        cursor.execute(
            """ 
            UPDATE tasks SET series_id = id where id = %s;
            """,
            (new_id,),
        )
        conn.commit()

        return new_id
    except Exception as err:
        if conn:
            conn.rollback()
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def create_tasks_from_list(user_id, tasks):
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            INSERT INTO tasks (
                title, description, category, start_at, end_at, 
                user_id, is_completed, completed_at, is_repeating, repeat_by, repeat_until
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        data = [
            (
                t.get("title"),
                t.get("description"),
                t.get("category", "General"),
                t.get("startAt"),
                t.get("endAt"),
                user_id,
                1 if t.get("isCompleted") else 0,
                t.get("completedAt"),
                1 if t.get("repeatBy") else 0,
                t.get("repeatBy"),
                t.get("repeatUntil"),
            )
            for t in tasks
        ]

        start_id = cursor.lastrowid
        count = cursor.rowcount

        cursor.execute(
            """
            UPDATE tasks 
            SET series_id = id 
            WHERE id BETWEEN %s AND %s
        """,
            (start_id, start_id + count - 1),
        )

        conn.commit()
        return count

    except Exception as err:
        if conn:
            conn.rollback()
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def update_task(user_id, task_id, data):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM tasks WHERE id = %s AND user_id = %s", (task_id, user_id)
        )
        task = cursor.fetchone()
        if not task:
            return None

        updated_data = {
            "title": str(data.get("title", task["title"])).strip(),
            "description": str(data.get("description", task["description"])).strip(),
            "category": str(data.get("category", task["category"])).strip(),
            "start_at": data.get("startAt", task["start_at"]),
            "end_at": data.get("endAt", task["end_at"]),
            "is_completed": bool(data.get("isCompleted", task["is_completed"])),
            "completed_at": data.get("completedAt", task["completed_at"]),
            "is_repeating": bool(data.get("isRepeating", task["is_repeating"])),
            "repeat_by": data.get("repeatBy", task["repeat_by"]),
            "repeat_until": data.get("repeatUntil", task["repeat_until"]),
            "created_at": task["created_at"],
        }

        cursor.execute(
            """
            UPDATE tasks 
            SET title=%s, description=%s, category=%s, start_at=%s, end_at=%s, 
                is_completed=%s, completed_at=%s, is_repeating=%s, 
                repeat_by=%s, repeat_until=%s
            WHERE id=%s AND user_id=%s
        """,
            (
                updated_data["title"],
                updated_data["description"],
                updated_data["category"],
                updated_data["start_at"],
                updated_data["end_at"],
                int(updated_data["is_completed"]),
                updated_data["completed_at"],
                int(updated_data["is_repeating"]),
                updated_data["repeat_by"],
                updated_data["repeat_until"],
                task_id,
                user_id,
            ),
        )
        repeat_until_val = updated_data["repeat_until"]

        if isinstance(repeat_until_val, str):
            repeat_until_val = datetime.strptime(
                updated_data["repeat_until"], "%Y-%m-%d"
            ).date()

        is_within_limit = (
            not repeat_until_val or repeat_until_val > datetime.now().date()
        )

        if (
            updated_data["is_completed"]
            and not task["is_completed"]
            and updated_data["is_repeating"]
            and is_within_limit
        ):
            _handle_repeat_task(cursor, user_id, task)

        conn.commit()
        return {**updated_data, "id": task_id, "created_at": task["created_at"]}

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def _handle_repeat_task(cursor, user_id, original_task):
    cursor.execute(
        """INSERT INTO tasks (title, description, category, start_at, end_at, 
           is_repeating, user_id, series_id, is_completed, created_at) 
           VALUES (%s, %s, %s, %s, %s, 0, %s, %s, 1, %s)""",
        (
            original_task["title"],
            original_task["description"],
            original_task["category"],
            original_task["start_at"],
            original_task["end_at"],
            user_id,
            original_task["id"],
            original_task["created_at"],
        ),
    )

    next_start = update_date(original_task["start_at"], original_task["repeat_by"])
    next_end = update_date(original_task["end_at"], original_task["repeat_by"])

    cursor.execute(
        """UPDATE tasks 
           SET start_at = %s, end_at = %s, is_completed = 0, series_id = id, created_at = %s 
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
    return old_date


def delete_task(user_id, task_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM tasks WHERE user_id = %s AND id = %s ", (user_id, task_id)
        )
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
