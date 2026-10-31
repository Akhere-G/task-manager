import json
import logging
import os
from datetime import date, datetime, timezone

from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from google import genai
from google.genai import types
from groq import Groq

from app.constants import CATEGORIES
from app.database import db
from app.exceptions import AIUnavailable
from app.models import DailyBrief
from app.schemas.ai_schema import AiTaskSchema

from app.services.stats_service import get_brief_stats
from app.services.task_query import TaskQuery
from app.services.task_service import get_all_tasks
from app.utils.dates import local_today

logger = logging.getLogger(__name__)

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


def _ask_gemini(prompt):
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
        http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
    )
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    return response.text


def _ask_groq(prompt):
    completion = Groq(api_key=os.getenv("GROQ_API_KEY")).chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        timeout=10.0,
    )
    return completion.choices[0].message.content


def get_generated_text(prompt):
    for name, ask in (("Gemini", _ask_gemini), ("Groq", _ask_groq)):
        try:
            if text := ask(prompt):
                return text
        except Exception as exc:
            logger.warning("%s request failed: %s", name, type(exc).__name__)
    raise AIUnavailable()


def _extract_json(raw):
    text = (raw or "").strip()
    if "```" in text:
        text = text.split("```")[1].strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return json.loads(text)



def _find_brief(user_id, day):
    return db.session.scalar(
        db.select(DailyBrief).where(
            DailyBrief.user_id == user_id, DailyBrief.generated_date == day
        )
    )


def _store_brief(user_id, day, text):
    """Save the brief; if a parallel request saved one first, return that instead."""
    db.session.add(DailyBrief(user_id=user_id, brief_text=text, generated_date=day))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return db.session.execute(
            db.select(DailyBrief).where(
                DailyBrief.user_id == user_id, DailyBrief.generated_date == day
            )
        ).scalar_one().brief_text
    return text


def _brief_prompt(day, tasks, stats):
    completed_this_week = sum(d["tasks"] for d in stats["productivity"][-7:])
    average = completed_this_week / 7
    minutes_today = sum(
        int((t.end_at - t.start_at).total_seconds() / 60)
        for t in tasks
        if t.start_at and t.end_at
    )
    volume = "\n".join(
        f"- {v['category']}: {v['pending']} pending, {v['overdue']} overdue"
        for v in stats["categoryVolume"]
    )
    schedule = "\n".join(
        f"- {t.title} ({t.category}, {t.start_at} - {t.end_at})" for t in tasks
    )

    return f"""
    Persona: Encouraging, positive and grounded productivity coach.
    Date: {day.strftime("%A, %d %B")}
    Recent Productivity: {completed_this_week} completed this week. Avg {average:.1f}/day.
    Current Volume:
    {volume}

    Today's Schedule ({minutes_today}m):
    {schedule or "No tasks scheduled."}

    Instructions:
    1. Give a 'Vibe Check'.
    2. Identify the 'Main Event'.
    3. Address high overdue counts.
    4. Compare today's workload to the {average:.1f} average.
    5. Under 125 words, British English, Markdown format.
    """


def generate_daily_brief(user_id, timezone_name=None):
    try:
        day = local_today(timezone_name)
        if existing := _find_brief(user_id, day):
            return existing.brief_text, False

        todays_tasks = get_all_tasks(
            user_id,
            TaskQuery(
                start_date=day.isoformat(),
                end_date=day.isoformat(),
                is_completed=False,
                project_repeating=True,
            ),
        )["tasks"]
        prompt = _brief_prompt(day, todays_tasks, get_brief_stats(user_id))
        return _store_brief(user_id, day, get_generated_text(prompt)), False
    except (Exception, SQLAlchemyError) as err:
        db.session.rollback()
        logger.warning("Could not generate the daily brief: %s", type(err).__name__)
        return FALLBACK_BRIEF, True



def _parse_prompt(user_input, now):
    return f"""
    Current Date and Time: {now.strftime("%Y-%m-%d %H:%M:%S")}
    Extract task details from: "{user_input}"
    Return ONLY a JSON object, with no other comments with these keys:
    - title: (string)
    - description: (string or null), put any extra information here
    - category: (MUST be one of: {", ".join(CATEGORIES)})
    - startAt: Datetime (MUST be present), use YYYY-MM-DD HH:MM. Should be set to any date time mention. If no time mentioned, use {now:%Y-%m-%d} 00:00.
    - endAt: Datetime use YYYY-MM-DD HH:MM (MUST be present). Should be after startAt but on the same day. If no time mentioned, if a duration was mentioned, add that to the start date and set this to that. Otherwise set to an hour after start at.
    - isRepeating: boolean. True if task is daily/every day, weekly, monthly, yearly or repeated
    - repeatBy: ENUM ("daily", "weekly", "monthly", "yearly") or null. For repeating tasks: Identify the frequency mentioned.
    - repeatInterval: integer of 1 or more, default 1. "every 2 weeks" is 2, "every 3 days" is 3, "every other month" is 2.
    - repeatDays: list or null. Only when specific days are mentioned.
        weekly: weekday numbers where Monday is 0 and Sunday is 6, e.g. "Monday and Thursday" is [0, 3].
        monthly: days of the month from 1 to 31, e.g. "the 1st and 15th" is [1, 15].
        yearly: "MM-DD" strings, e.g. "14 February and 25 December" is ["02-14", "12-25"].
        Use null for daily tasks, when no specific days are mentioned, or when the task does not repeat.
    - repeatUntil DATE or Null. use YYYY-MM-DD. For repeating tasks: Identify the end date mentioned.
    """


def _decompose_prompt(title, description, category, start_at, end_at):
    return f"""
    Decompose this task into 3-7 substasks that will help the user complete the task.
    - {title} ({category}, {description}, {start_at} to {end_at})
    Return only a json list of objects of this format
    - title: (string)
    - description: (string or null)
    - category: (MUST be one of: {", ".join(CATEGORIES)})
    - startAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, assume today is {date.today():%Y-%m-%d}. If no time mentioned, default to end of day 00:00)
    - endAt: (ISO timestamp YYYY-MM-DD HH:MM:SS, If no due date mentioned, default to end of day 23:59)
    """


def parse_task_with_ai(user_input):
    now = datetime.now(timezone.utc)
    reply = get_generated_text(_parse_prompt(user_input, now))
    try:
        schema = AiTaskSchema()
        return schema.dump(schema.load(_extract_json(reply)))
    except (ValueError, ValidationError):
        return {
            "title": user_input[:50],
            "description": user_input,
            "category": "general",
            "startAt": f"{now:%Y-%m-%d} 00:00",
            "endAt": f"{now:%Y-%m-%d} 23:59",
        }


def decompose_task(title, description, category, start_at, end_at):
    try:
        reply = get_generated_text(
            _decompose_prompt(title, description, category, start_at, end_at)
        )
        schema = AiTaskSchema(many=True)
        return schema.dump(schema.load(_extract_json(reply)))
    except (AIUnavailable, ValueError, ValidationError):
        return []
