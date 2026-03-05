import os
import json
import datetime
from datetime import date
from google import genai
from groq import Groq
from db import get_db_connection
from services.stats_service import get_all_dashboard_stats
from services.task_service import get_all_tasks

allowed_categories = [
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


def get_generated_text(prompt):
    try:
        client_gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client_gemini.models.generate_content(
            model="gemini-2.0-flash", contents=prompt
        )
        if response.text:
            return response.text
    except Exception:
        pass

    try:
        client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        completion = client_groq.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a pragmatic and grounded productivity coach. Who uses British English",
                },
                {"role": "user", "content": prompt},
            ],
            timeout=10.0,
        )
        return completion.choices[0].message.content
    except Exception:
        raise Exception("All AI providers failed.")


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
        avg_daily_completion = (
            total_completed_week / 7 if total_completed_week > 0 else 0
        )

        volume_summary = "\n".join(
            [
                f"- {v['category']}: {v['pending']} pending, {v['overdue']} overdue"
                for v in stats.get("categoryVolume", [])
            ]
        )

        total_mins_today = 0
        for t in today_tasks:
            start = t["start_at"]
            end = t["end_at"]
            if start and end:
                delta = end - start
                total_mins_today += int(delta.total_seconds() / 60)

        task_list_str = "\n".join(
            [
                f"- {t['title']} ({t['category']}, {t['start_at']} - {t['end_at']})"
                for t in today_tasks
            ]
        )

        prompt = f"""
        Persona: Pragmatic and grounded productivity coach.
        Date: {today.strftime("%A, %d %B")}
        Recent Productivity: {total_completed_week} completed this week. Avg {avg_daily_completion:.1f}/day.
        Current Volume: 
        {volume_summary}
        
        Today's Schedule ({total_mins_today}m): 
        {task_list_str if task_list_str else "No tasks scheduled."}

        Instructions:
        1. Give a 'Vibe Check'.
        2. Identify the 'Main Event'.
        3. Address high overdue counts.
        4. Compare today's workload to the {avg_daily_completion:.1f} average.
        5. Under 125 words, British English, Markdown format.
        """

        generated_text = get_generated_text(prompt)
        cursor.execute(
            "INSERT INTO daily_briefs (user_id, brief_text, generated_date) VALUES (%s, %s, %s)",
            (user_id, generated_text, today),
        )
        conn.commit()

        return generated_text

    except Exception:
        return "I've had a bit of a wobble fetching your brief. Looking at your list though, you've got this. Onwards!"

    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def parse_task_with_ai(user_input):
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    prompt = f"""
    Current Date and Time: {now.strftime("%Y-%m-%d %H:%M:%S")}
    Extract task details from: "{user_input}"
    Return ONLY a JSON object, with no other comments with these keys:
    - title: (string)
    - description: (string or null)
    - category: (MUST be one of: {", ".join(allowed_categories)})
    - startAt: Use YYYY-MM-DD HH:MM:SS. If no time mentioned, use {today_str} 00:00.
    - endAt: Use YYYY-MM-DD HH:MM:SS. If no time mentioned, use {today_str} 23:59.
    """

    raw_json = get_generated_text(prompt)
    clean_json = raw_json.replace("```json", "").replace("```", "").strip()

    try:
        parsed_data = json.loads(clean_json)
        if parsed_data.get("category") not in allowed_categories:
            parsed_data["category"] = "general"
        if not parsed_data.get("startAt"):
            parsed_data["startAt"] = datetime.now().strftime("%Y-%m-%d 23:59:59")
        if not parsed_data.get("endAt"):
            parsed_data["endAt"] = datetime.now().strftime("%Y-%m-%d 23:59:59")
        return parsed_data
    except Exception:
        return {
            "title": user_input[:50],
            "description": user_input,
            "category": "general",
            "startAt": f"{today_str} 00:00",
            "endAt": f"{today_str} 23:59",
        }


def decompose_task(title, description, category, start_at, end_at):
    today = date.today().strftime("%Y-%m-%d")

    task_details = f"- {title} ({category}, {description}, {start_at} to {end_at})"

    prompt = f"""
    Decompose this task into 3-7 substasks that will help the user complete the task.
    {task_details}
    Return only a json list of objects of this format
    - title: (string)
    - description: (string or null)
    - category: (MUST be one of: {", ".join(allowed_categories)})
    - startAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, assume today is {today}. If no time mentioned, default to end of day 00:00)
    - endAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, If no due date mentioned, default to end of day 23:59)
    """
    try:
        raw_json = get_generated_text(prompt)

        clean_json = raw_json.strip()

        if "```" in clean_json:
            parts = clean_json.split("```")
            clean_json = parts[1].strip()

            if clean_json.lower().startswith("json"):
                clean_json = clean_json[4:].strip()

        tasks = json.loads(clean_json)

        if not isinstance(tasks, list):
            return []
        return tasks
    except Exception:
        return []
