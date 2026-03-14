from db import get_db_connection
from datetime import date, timedelta, datetime
from dateutil.relativedelta import relativedelta


def get_all_tasks(
    user_id,
    category=None,
    search=None,
    duration=None,
    is_completed=None,
    due_date=None,
    today=None,
    sort_by=None,
    order=None,
    limit=None,
    page=None,
):
    conn = None
    cursor = None
    try:
        SHORT_TASK_THRESHOLD = 30
        if today is None:
            today = date.today()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        params = [user_id]
        base_filters = " WHERE user_id = %s"

        if category and category != "all":
            base_filters += " AND category = %s"
            params.append(category)

        if search:
            base_filters += " AND MATCH(title, description) AGAINST(%s IN BOOLEAN MODE)"
            params.append(f"{search}*")

        if is_completed is not None and is_completed != "all":
            is_completed_val = 1 if str(is_completed).lower() == "true" else 0
            base_filters += " AND is_completed = %s"
            params.append(is_completed_val)

        if due_date:
            if due_date == "today":
                base_filters += " AND DATE(end_at) = %s"
                params.append(today)
            if due_date == "this_week":
                base_filters += (
                    " AND end_at BETWEEN %s AND DATE_ADD(%s, INTERVAL 7 DAY)"
                )
                params.extend([today, today])
            if due_date == "this_month":
                base_filters += (
                    " AND end_at BETWEEN %s AND DATE_ADD(%s, INTERVAL 30 DAY)"
                )
                params.extend([today, today])
            if due_date == "overdue":
                base_filters += " AND end_at < %s AND is_completed = 0"
                params.append(today)

        if duration:
            if duration == "short_tasks":
                base_filters += " AND TIMESTAMPDIFF(MINUTE, start_at, end_at) <= %s"
                params.append(SHORT_TASK_THRESHOLD)
            elif duration == "long_tasks":
                base_filters += " AND TIMESTAMPDIFF(MINUTE, start_at, end_at) > %s"
                params.append(SHORT_TASK_THRESHOLD)

        count_query = f"SELECT COUNT(*) as total FROM tasks{base_filters}"
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()["total"]

        SORTABLE_FIELDS = ["created_at", "title", "start_at", "duration"]
        sort_by_field = sort_by if sort_by in SORTABLE_FIELDS else "created_at"

        if sort_by_field == "duration":
            sort_by_field = "TIMESTAMPDIFF(MINUTE, start_at, end_at)"

        order_value = "ASC" if order == "asc" else "DESC"

        data_query = (
            f"SELECT * FROM tasks{base_filters} ORDER BY {sort_by_field} {order_value}"
        )
        if page is not None and limit is not None:
            page = max(int(page), 1)
            limit = max(int(limit), 1)
            offset = limit * (page - 1)
            data_query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])
        else:
            page = 1
            offset = 0
            limit = total_count if total_count > 0 else 1

        cursor.execute(data_query, params)
        tasks = cursor.fetchall()

        for task in tasks:
            task["is_completed"] = True if task["is_completed"] == 1 else False
            task["is_repeating"] = True if task["is_repeating"] == 1 else False

        return {
            "tasks": tasks,
            "total_tasks": total_count,
            "total_pages": (total_count + int(limit) - 1) // int(limit),
            "current_page": int(page),
        }
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


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

        cursor.executemany(sql, data)
        conn.commit()

        return cursor.rowcount

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
