from db import get_db_connection
from datetime import datetime, date
from utils.task_utils import (
    build_task_filters,
    with_repeating,
    check_should_repeat,
    handle_repeat_task,
)


def get_all_tasks(
    user_id,
    category=None,
    search=None,
    duration=None,
    is_completed=None,
    start_date=None,
    end_date=None,
    sort_by=None,
    order=None,
    limit=None,
    page=None,
    project_repeating=False,
):

    conn = None
    cursor = None
    try:
        base_filters, params = build_task_filters(
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
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")

            base_filters, params = build_task_filters(
                user_id=user_id,
                category=category,
                search=search,
                is_completed=is_completed,
                duration=duration,
            )

            tasks = with_repeating(
                tasks, start, end, user_id, cursor, base_filters, params
            )

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
                user_id, is_completed, completed_at, is_repeating, repeat_by, repeat_until, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        data = [
            (
                t.get("title"),
                (t.get("description").strip() if t.get("description") else None),
                t.get("category", "General"),
                t.get("startAt"),
                t.get("endAt"),
                user_id,
                1 if t.get("isCompleted") else 0,
                t.get("completedAt"),
                1 if t.get("repeatBy") else 0,
                t.get("repeatBy"),
                t.get("repeatUntil"),
                t.get("createdAt") or date.today(),
            )
            for t in tasks
        ]

        cursor.executemany(sql, data)

        count = cursor.rowcount

        cursor.execute(
            """
            UPDATE tasks 
            SET series_id = id 
            WHERE series_id IS NULL AND user_id = %s
        """,
            (user_id,),
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

        if check_should_repeat(task, updated_data):
            handle_repeat_task(cursor, user_id, task)

        conn.commit()
        return {**updated_data, "id": task_id, "created_at": task["created_at"]}

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
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
