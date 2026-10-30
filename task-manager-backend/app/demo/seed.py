"""Reset the shared demo account from fixtures/demo_data.json: python -m app.demo.seed"""

import json
import random
import re
import secrets
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from app.database import SessionLocal, engine
from app.demo import DEMO_USER_EMAIL
from app.models import (
    DailyBrief,
    Notification,
    NotificationSubscription,
    PasswordReset,
    RefreshToken,
    Task,
    User,
)
from app.utils.recurrence import default_days, previous_occurrence
from dateutil.relativedelta import relativedelta
from sqlalchemy import delete, select
from werkzeug.security import generate_password_hash

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "demo_data.json"
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def resolve_time(spec, now, tz):
    """Turn "D-3 09:00", "W-1 wed 19:00", "next mon 10:00", "next 07:00" or
    "next dom 1 09:00" into a naive UTC datetime relative to `now`."""
    today = now.replace(tzinfo=timezone.utc).astimezone(tz).date()
    monday = today - timedelta(days=today.weekday())

    def at(day, hour, minute):
        local = datetime.combine(day, time(int(hour), int(minute)), tzinfo=tz)
        return local.astimezone(timezone.utc).replace(tzinfo=None)

    if m := re.fullmatch(r"D([+-]\d+) (\d\d):(\d\d)", spec):
        return at(today + timedelta(days=int(m[1])), m[2], m[3])
    if m := re.fullmatch(r"W([+-]\d+) (\w{3}) (\d\d):(\d\d)", spec):
        day = monday + timedelta(weeks=int(m[1]), days=WEEKDAYS.index(m[2]))
        return at(day, m[3], m[4])
    if m := re.fullmatch(r"next (\w{3}) (\d\d):(\d\d)", spec):
        days = (today + timedelta(days=i) for i in range(8))
        candidates = (
            at(d, m[2], m[3]) for d in days if d.weekday() == WEEKDAYS.index(m[1])
        )
    elif m := re.fullmatch(r"next (\d\d):(\d\d)", spec):
        candidates = (at(today + timedelta(days=i), m[1], m[2]) for i in range(3))
    elif m := re.fullmatch(r"next dom (\d+) (\d\d):(\d\d)", spec):
        months = (today.replace(day=1) + relativedelta(months=i) for i in range(3))
        candidates = (at(d.replace(day=int(m[1])), m[2], m[3]) for d in months)
    else:
        raise ValueError(f"Unrecognised time spec {spec!r}")
    return next(c for c in candidates if c > now)


def step_back(value, repeat, n, tz):
    """The occurrence `n` steps before `value`, the inverse of what completing a task does."""
    for _ in range(n):
        value = previous_occurrence(
            value, repeat["by"], repeat.get("interval", 1), repeat.get("days"), tz
        )
    return value


def build_rows(fixture, now):
    """Task rows as dicts. History rows carry `master`, the index of their recurring task."""
    tz = ZoneInfo(fixture["timezone"])
    rng = random.Random(fixture["seed"])
    rows = []

    for item in fixture["tasks"]:
        if "title" not in item:
            continue

        start = resolve_time(item["start"], now, tz)
        length = timedelta(minutes=item["mins"])
        repeat = item.get("repeat")
        common = {
            "title": item["title"],
            "description": item.get("description"),
            "category": item["category"],
        }

        # Completed past occurrences, newest first, like the app writes when a recurring
        # task is completed.
        history = []
        if "history" in item:
            h = item["history"]
            for n in sorted(h["n"]):
                h_start = step_back(start, repeat, n, tz)
                jitter = rng.randint(-h["jitter_min"], h["jitter_min"])
                done = h_start + timedelta(minutes=h["done_after_min"] + jitter)
                done = min(done, now - timedelta(minutes=1))
                if done > h_start:
                    history.append({"start_at": h_start, "completed_at": done})
            for newer, older in zip(history, history[1:]):
                newer["created_at"] = older["completed_at"]
            history[-1]["created_at"] = resolve_time(h["series_created"], now, tz)

        master = len(rows)
        rows.append(
            {
                **common,
                "start_at": start,
                "end_at": start + length,
                "created_at": resolve_time(item["created"], now, tz)
                if "created" in item
                else history[0]["completed_at"],
                "completed_at": resolve_time(item["done"], now, tz)
                if "done" in item
                else None,
                "repeat_by": repeat["by"] if repeat else None,
                "repeat_interval": repeat.get("interval", 1) if repeat else 1,
                "repeat_days": (
                    repeat.get("days") or default_days(start, repeat["by"], tz)
                    if repeat
                    else None
                ),
                "repeat_timezone": fixture["timezone"] if repeat else None,
                "repeat_until": resolve_time(repeat["until"] + " 12:00", now, tz).date()
                if repeat and repeat["until"]
                else None,
            }
        )
        for h in history:
            rows.append(
                {
                    **common,
                    "end_at": h["start_at"] + length,
                    "repeat_by": None,
                    "repeat_until": None,
                    "repeat_interval": 1,
                    "repeat_days": None,
                    "repeat_timezone": None,
                    "master": master,
                    **h,
                }
            )

    return rows


def reset_demo_account(now=None):
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    rows = build_rows(fixture, now)

    with SessionLocal() as session:
        user = session.execute(
            select(User).where(User.email == DEMO_USER_EMAIL).with_for_update()
        ).scalar_one_or_none()

        if user is None:
            user = User(
                email=DEMO_USER_EMAIL,
                password_hash=generate_password_hash(secrets.token_urlsafe(48)),
                is_demo=True,
                **fixture["user"],
            )
            session.add(user)
        elif user.is_demo:
            user.first_name = fixture["user"]["first_name"]
            user.last_name = fixture["user"]["last_name"]
        else:
            raise RuntimeError(f"{DEMO_USER_EMAIL} belongs to a real account")
        session.flush()

        for model in (
            Notification,
            NotificationSubscription,
            DailyBrief,
            PasswordReset,
            Task,
        ):
            session.execute(delete(model).where(model.user_id == user.id))
        # Unexpired refresh tokens stay so visitors are not logged out by a reset.
        session.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.expires_at < now
            )
        )

        tasks = [
            Task(
                **{k: v for k, v in row.items() if k != "master"},
                is_completed=row.get("completed_at") is not None,
                is_repeating=row["repeat_by"] is not None,
                user_id=user.id,
            )
            for row in rows
        ]
        session.add_all(tasks)
        session.flush()
        for row, task in zip(rows, tasks):
            task.series_id = tasks[row["master"]].id if "master" in row else task.id

        session.add(
            DailyBrief(
                user_id=user.id,
                brief_text=fixture["daily_brief"]["markdown"],
                generated_date=date.today(),
            )
        )
        session.commit()

    return len(rows)


if __name__ == "__main__":
    print(f"Resetting the demo account in {engine.url.host}/{engine.url.database}")
    print(f"Done: {reset_demo_account()} tasks")
