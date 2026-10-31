"""Reset the shared demo account from fixtures/demo_data.json: python -m app.demo.seed"""

import json
import random
import secrets
from datetime import date, datetime, time, timedelta
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
from app.utils.dates import as_aware_utc, as_naive_utc, utc_now
from app.utils.recurrence import default_days, previous_occurrence
from dateutil.relativedelta import relativedelta
from sqlalchemy import delete, select
from werkzeug.security import generate_password_hash

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "demo_data.json"
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
CLEARED_MODELS = (Notification, NotificationSubscription, DailyBrief, PasswordReset, Task)


def resolve_time(spec, now, tz):
    """Turn "D-3 09:00", "W-1 wed 19:00", "next mon 10:00", "next 07:00" or
    "next dom 1 09:00" into a naive UTC datetime relative to `now`."""
    today = as_aware_utc(now).astimezone(tz).date()
    monday = today - timedelta(days=today.weekday())
    head, *rest = spec.split()

    def at(day):
        hour, minute = map(int, rest[-1].split(":"))
        return as_naive_utc(datetime.combine(day, time(hour, minute), tzinfo=tz))

    if head[0] == "D" and len(rest) == 1:
        return at(today + timedelta(days=int(head[1:])))
    if head[0] == "W" and len(rest) == 2:
        return at(monday + timedelta(weeks=int(head[1:]), days=WEEKDAYS.index(rest[0])))
    if head == "next" and len(rest) == 1:
        days = (today + timedelta(days=i) for i in range(3))
    elif head == "next" and len(rest) == 2 and rest[0] in WEEKDAYS:
        days = (
            d
            for d in (today + timedelta(days=i) for i in range(8))
            if d.weekday() == WEEKDAYS.index(rest[0])
        )
    elif head == "next" and len(rest) == 3 and rest[0] == "dom":
        firsts = (today.replace(day=1) + relativedelta(months=i) for i in range(3))
        days = (first.replace(day=int(rest[1])) for first in firsts)
    else:
        raise ValueError(f"Unrecognised time spec {spec!r}")
    return next(c for c in map(at, days) if c > now)


def step_back(value, repeat, n, tz):
    """The occurrence `n` steps before `value`, the inverse of what completing a task does."""
    for _ in range(n):
        value = previous_occurrence(
            value, repeat["by"], repeat.get("interval", 1), repeat.get("days"), tz
        )
    return value


def repeat_columns(repeat, start, tz_name, now):
    if not repeat:
        return {}
    tz = ZoneInfo(tz_name)
    until = repeat.get("until")
    return {
        "is_repeating": True,
        "repeat_by": repeat["by"],
        "repeat_interval": repeat.get("interval", 1),
        "repeat_days": repeat.get("days") or default_days(start, repeat["by"], tz),
        "repeat_timezone": tz_name,
        "repeat_until": resolve_time(f"{until} 12:00", now, tz).date() if until else None,
    }


def build_history(item, start, length, common, now, tz, rng):
    """Completed past occurrences, newest first, like the app writes when a recurring
    task is completed."""
    h = item["history"]
    rows = []
    for n in sorted(h["n"]):
        h_start = step_back(start, item["repeat"], n, tz)
        jitter = rng.randint(-h["jitter_min"], h["jitter_min"])
        done = min(
            h_start + timedelta(minutes=h["done_after_min"] + jitter),
            now - timedelta(minutes=1),
        )
        if done > h_start:
            rows.append(
                Task(
                    **common,
                    start_at=h_start,
                    end_at=h_start + length,
                    is_completed=True,
                    completed_at=done,
                )
            )
    for newer, older in zip(rows, rows[1:]):
        newer.created_at = older.completed_at
    rows[-1].created_at = resolve_time(h["series_created"], now, tz)
    return rows


def build_series(fixture, now):
    """For each fixture task: the task itself and its completed history."""
    tz_name = fixture["timezone"]
    tz = ZoneInfo(tz_name)
    rng = random.Random(fixture["seed"])

    for item in fixture["tasks"]:
        if "title" not in item:
            continue

        start = resolve_time(item["start"], now, tz)
        length = timedelta(minutes=item["mins"])
        common = {k: item.get(k) for k in ("title", "description", "category")}
        history = build_history(item, start, length, common, now, tz, rng) if "history" in item else []

        created = item.get("created")
        done = item.get("done")
        task = Task(
            **common,
            start_at=start,
            end_at=start + length,
            created_at=resolve_time(created, now, tz) if created else history[0].completed_at,
            completed_at=resolve_time(done, now, tz) if done else None,
            is_completed=bool(done),
            **repeat_columns(item.get("repeat"), start, tz_name, now),
        )
        yield task, history


def reset_demo_account(now=None):
    now = now or utc_now()
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    series = list(build_series(fixture, now))

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

        for model in CLEARED_MODELS:
            session.execute(delete(model).where(model.user_id == user.id))
        # Unexpired refresh tokens stay so visitors are not logged out by a reset.
        session.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.expires_at < now
            )
        )

        count = 0
        for task, history in series:
            task.user_id = user.id
            session.add(task)
            session.flush()
            task.series_id = task.id
            for past in history:
                past.user_id, past.series_id = user.id, task.id
            session.add_all(history)
            count += 1 + len(history)

        session.add(
            DailyBrief(
                user_id=user.id,
                brief_text=fixture["daily_brief"]["markdown"],
                generated_date=date.today(),
            )
        )
        session.commit()

    return count


if __name__ == "__main__":
    print(f"Resetting the demo account in {engine.url.host}/{engine.url.database}")
    print(f"Done: {reset_demo_account()} tasks")
