from db import get_db_connection
from datetime import date


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

        title = data.get("title").strip() if "title" in data else None
        description = (
            str(data.get("description")).strip() if data.get("description") else None
        )
        category = str(data.get("category", "General")).strip()
        start_at = data.get("startAt")
        end_at = data.get("endAt")

        is_repeating = data.get("isRepeating")
        repeat_by = data.get("repeatBy")
        repeat_until = data.get("repeatUntil")

        cursor.execute(
            "INSERT INTO tasks (title, description, category, start_at, end_at, is_repeating, repeat_by, repeat_until, user_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
            (
                title,
                description,
                category,
                start_at,
                end_at,
                is_repeating,
                repeat_by,
                repeat_until,
                user_id,
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid
        return new_id
    except Exception as err:
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
    conn = None
    cursor = None
    try:
        title = str(data.get("title", "")).strip()
        description = (
            str(data.get("description")).strip() if data.get("description") else None
        )
        category = str(data.get("category", "")).strip()
        start_at = data.get("startAt")
        end_at = data.get("endAt")
        is_completed = data.get("isCompleted")
        completed_at = data.get("completedAt")
        is_repeating = data.get("isRepeating")
        repeat_by = data.get("repeatBy")
        repeat_until = data.get("repeatUntil")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM tasks WHERE id = %s and user_id = %s", (task_id, user_id)
        )
        task = cursor.fetchone()

        if task is None:
            return None

        updated_title = title if title else task["title"]
        updated_desc = description if description else task["description"]
        updated_cat = category if category else task["category"]
        updated_start = start_at if start_at else task["start_at"]
        updated_end = end_at if end_at else task["end_at"]
        updated_status = (
            is_completed if is_completed is not None else task["is_completed"]
        )
        updated_completed_at = (
            completed_at if "completedAt" in data else task["completed_at"]
        )
        updated_is_repeating = (
            is_repeating if "isRepeating" in data else task["is_repeating"]
        )
        updated_repeat_by = repeat_by if "repeatBy" in data else task["repeat_by"]
        updated_repeat_until = (
            repeat_until if "repeatUntil" in data else task["repeat_until"]
        )

        cursor.execute(
            """
            UPDATE tasks 
            SET title = %s, description = %s, category = %s, start_at = %s, end_at = %s, is_completed = %s, completed_at = %s,
            is_repeating = %s, repeat_by = %s, repeat_until = %s
            WHERE id = %s and user_id = %s
            """,
            (
                updated_title,
                updated_desc,
                updated_cat,
                updated_start,
                updated_end,
                int(updated_status),
                updated_completed_at,
                int(updated_is_repeating),
                updated_repeat_by,
                updated_repeat_until,
                task_id,
                user_id,
            ),
        )

        conn.commit()

        return {
            "id": task_id,
            "title": updated_title,
            "description": updated_desc,
            "category": updated_cat,
            "start_at": updated_start,
            "end_at": updated_end,
            "is_completed": True if updated_status == 1 else False,
            "is_repeating": True if updated_is_repeating == 1 else False,
            "repeat_by": updated_repeat_by,
            "repeat_until": "updated_repeat_until",
            "created_at": task.get("created_at"),
            "completed_at": updated_completed_at,
        }
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


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
