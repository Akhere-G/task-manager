import os
from google import genai
from datetime import date
from services.stats_service import get_all_dashboard_stats
from services.task_service import get_all_tasks
from db import get_db_connection

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-3-flash-preview"


def generate_daily_brief(user_id):
    conn = None
    cursor = None
    try:
        today = date.today()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT brief_text FROM daily_briefs WHERE user_id = %s AND generated_date = %s",
            (user_id, today),
        )
        existing = cursor.fetchone()
        if existing:
            return existing["brief_text"]

        today_data = get_all_tasks(
            user_id=user_id, due_date="today", is_completed=False
        )
        today_tasks = today_data.get("tasks", [])
        stats = get_all_dashboard_stats(user_id)

        recent_productivity = stats.get("productivity", [])[-7:]
        total_completed_week = sum(d["tasks"] for d in recent_productivity)
        avg_daily_completion = total_completed_week / 7

        volume_data = stats.get("categoryVolume", [])
        volume_summary = "\n".join(
            [
                f"- {v['category']}: {v['pending']} pending, {v['overdue']} overdue, {v['completed']} completed"
                for v in volume_data
            ]
        )

        total_mins_today = sum(t.get("estimated_time", 0) for t in today_tasks)
        task_list_str = "\n".join(
            [
                f"- {t['title']} ({t['category']}, {t['estimated_time']}m)"
                for t in today_tasks
            ]
        )

        prompt = f"""
        Persona: Pragmatic, grounded, and witty British productivity coach.
        Date: {today.strftime("%A, %d %B")}
        Recent Productivity (7 Days): Completed {total_completed_week}, Avg {avg_daily_completion:.1f}/day.
        Category Volume: {volume_summary}
        Today's Schedule ({total_mins_today}m): {task_list_str if task_list_str else "No tasks scheduled."}

        Instructions:
        1. Give a 'Vibe Check'.
        2. Identify the 'Big Frog'.
        3. Address high overdue counts.
        4. Compare today to the {avg_daily_completion:.1f} average.
        5. Under 150 words, British English, Markdown.
        """

        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        generated_text = response.text

        cursor.execute(
            "INSERT INTO daily_briefs (user_id, brief_text, generated_date) VALUES (%s, %s, %s)",
            (user_id, generated_text, today),
        )
        conn.commit()

        return generated_text

    except Exception as e:
        print(f"AI Service Error: {e}")
        return "I've had a bit of a wobble fetching your brief. Looking at your list though, you've got this. Onwards!"
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
