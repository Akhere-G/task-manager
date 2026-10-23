import json
import logging
import os
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from google import genai
from google.genai import types
from groq import Groq

from marshmallow import ValidationError

from app.database import db
from app.models import DailyBrief
from app.schemas.ai_schema import AiTaskSchema
from app.schemas.constants import VALID_CATEGORIES

from app.services.stats_service import get_brief_stats
from app.services.task_query import TaskQuery
from app.services.task_service import get_all_tasks

logger = logging.getLogger(__name__)

MAX_SUBTASKS = 7
GEMINI_TIMEOUT_MS = 10_000
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
SYSTEM_PROMPT = (
    "You are an encouraging, positive and grounded productivity coach "
    "who uses British English."
)
FALLBACK_BRIEF = (
    "I've had a bit of a wobble fetching your brief. "
    "Looking at your list though, you've got this. Onwards!"
)

def get_generated_text(prompt):
    try:
        client_gemini = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY"),
            http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
        )
        response = client_gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        if response.text:
            return response.text
    except Exception as exc:
        logger.warning("Gemini request failed: %s", type(exc).__name__)

    try:
        client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        completion = client_groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            timeout=10.0,
        )
        return completion.choices[0].message.content
    except Exception as exc:
        logger.warning("Groq request failed: %s", type(exc).__name__)
        raise Exception("All AI providers failed.")


def extract_json(text):
    cleaned = text.strip()
    if "```" in cleaned:
        cleaned = cleaned.split("```")[1].strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return json.loads(cleaned)


def local_today(timezone_name):
    try:
        zone = ZoneInfo(timezone_name) if timezone_name else timezone.utc
    except Exception:
        zone = timezone.utc
    return datetime.now(zone).date()


def generate_daily_brief(user_id, timezone_name=None):
    try:
        today = local_today(timezone_name)
        today_str = today.strftime("%Y-%m-%d")

        existing_brief = db.session.execute(
            db.select(DailyBrief).where(
                DailyBrief.user_id == user_id, DailyBrief.generated_date == today
            )
        ).scalar_one_or_none()

        if existing_brief:
            return existing_brief.brief_text, False

        today_data = get_all_tasks(
            user_id,
            TaskQuery(
                start_date=today_str,
                end_date=today_str,
                is_completed=False,
                project_repeating=True,
            ),
        )
        today_tasks = today_data.get("tasks", [])
        stats = get_brief_stats(user_id)

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
        Persona: Encouraging, positive and grounded productivity coach.
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

        new_brief = DailyBrief(
            user_id=user_id, brief_text=generated_text, generated_date=today
        )
        db.session.add(new_brief)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            stored = db.session.execute(
                db.select(DailyBrief).where(
                    DailyBrief.user_id == user_id, DailyBrief.generated_date == today
                )
            ).scalar_one()
            return stored.brief_text, False

        return generated_text, False

    except (Exception, SQLAlchemyError) as err:
        db.session.rollback()
        logger.warning("Could not generate the daily brief: %s", type(err).__name__)
        return FALLBACK_BRIEF, True


def parse_task_with_ai(user_input):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    prompt = f"""
    Current Date and Time: {now.strftime("%Y-%m-%d %H:%M:%S")}
    Extract task details from: "{user_input}"
    Return ONLY a JSON object, with no other comments with these keys:
    - title: (string)
    - description: (string or null), put any extra information here
    - category: (MUST be one of: {", ".join(VALID_CATEGORIES)})
    - startAt: Datetime (MUST be present), use YYYY-MM-DD HH:MM. Should be set to any date time mention. If no time mentioned, use {today_str} 00:00.
    - endAt: Datetime use YYYY-MM-DD HH:MM (MUST be present). Should be after startAt but on the same day. If no time mentioned, if a duration was mentioned, add that to the start date and set this to that. Otherwise set to an hour after start at.
    - isRepeating: boolean. True if task is daily/every day, weekly, monthly, yearly or repeated
    - repeatBy: ENUM ("daily", "weekly", "monthly", "yearly") or null. For repeating tasks: Identify the frequency mentioned.
    - repeatUntil DATE or Null. use YYYY-MM-DD. For repeating tasks: Identify the end date mentioned.
    """

    try:
        return AiTaskSchema().load(extract_json(get_generated_text(prompt) or ""))
    except (ValueError, ValidationError):
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
    - category: (MUST be one of: {", ".join(VALID_CATEGORIES)})
    - startAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, assume today is {today}. If no time mentioned, default to end of day 00:00)
    - endAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, If no due date mentioned, default to end of day 23:59)
    """
    try:
        items = extract_json(get_generated_text(prompt) or "")
    except Exception:
        return []

    if not isinstance(items, list):
        return []

    subtasks = []
    for item in items[:MAX_SUBTASKS]:
        try:
            subtasks.append(AiTaskSchema().load(item))
        except ValidationError:
            continue
    return subtasks
