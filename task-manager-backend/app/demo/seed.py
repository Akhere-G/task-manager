"""Reset the shared demo account from app/demo/fixtures/demo_data.json.

    python -m app.demo.seed --dry-run
    python -m app.demo.seed --confirm-db <database name>

The fixture only contains relative dates ("D-3 09:00", "next mon 10:00"...), which are
resolved against the current time, so the script is meant to run on a schedule.

Everything that writes happens in one transaction and only ever touches rows that
belong to the single user proven to be is_demo = 1 with the reserved demo email.
"""

import argparse
import json
import random
import re
import secrets
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil.relativedelta import relativedelta

from app.demo import DEMO_USER_EMAIL

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "demo_data.json"
LOCK_NAME = "taskflow_demo_seed"
FIXTURE_VERSION = 1

CATEGORIES = {
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
}
REPEAT_BY = {"daily", "weekly", "monthly", "yearly"}
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

TOP_LEVEL_KEYS = {"fixture_version", "timezone", "seed", "user", "tasks", "daily_brief"}
TASK_KEYS = {
    "title",
    "description",
    "category",
    "start",
    "mins",
    "created",
    "done",
    "repeat",
    "history",
}
HISTORY_KEYS = {"n", "done_after_min", "jitter_min", "series_created"}

EXIT_BAD_FIXTURE = 1
EXIT_WRONG_DB = 2
EXIT_LOCKED = 3
EXIT_REAL_ACCOUNT = 4
EXIT_POSTCONDITION = 5


class DemoSeedError(Exception):
    def __init__(self, message, code=EXIT_BAD_FIXTURE):
        super().__init__(message)
        self.code = code


# --------------------------------------------------------------------------- #
# Time specs
# --------------------------------------------------------------------------- #

_WD = "(mon|tue|wed|thu|fri|sat|sun)"
_HM = r"(\d{2}):(\d{2})"
_RE_D = re.compile(rf"^D([+-]\d+) {_HM}$")
_RE_W = re.compile(rf"^W([+-]\d+) {_WD} {_HM}$")
_RE_NEXT_WD = re.compile(rf"^next {_WD} {_HM}$")
_RE_NEXT_T = re.compile(rf"^next {_HM}$")
_RE_NEXT_DOM = re.compile(rf"^next dom (\d{{1,2}}) {_HM}$")
_RE_DATE_D = re.compile(r"^D([+-]\d+)$")
_RE_DATE_W = re.compile(rf"^W([+-]\d+) {_WD}$")


@dataclass
class Clock:
    """Resolves fixture time specs to naive-UTC datetimes (the database convention)."""

    tz: ZoneInfo
    now: datetime  # naive UTC

    @property
    def today(self) -> date:
        return self._local_now().date()

    def _local_now(self) -> datetime:
        return self.now.replace(tzinfo=timezone.utc).astimezone(self.tz)

    def _monday(self) -> date:
        return self.today - timedelta(days=self.today.weekday())

    def to_utc(self, day: date, hour: int, minute: int) -> datetime:
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise DemoSeedError(f"Invalid time {hour:02d}:{minute:02d}")
        local = datetime.combine(day, time(hour, minute), tzinfo=self.tz)
        utc = local.astimezone(timezone.utc)
        # Rejects wall-clock times that do not exist (DST gap).
        if utc.astimezone(self.tz).replace(tzinfo=None) != local.replace(tzinfo=None):
            raise DemoSeedError(f"{day} {hour:02d}:{minute:02d} does not exist in {self.tz}")
        return utc.replace(tzinfo=None)

    def resolve_datetime(self, spec) -> datetime:
        if not isinstance(spec, str):
            raise DemoSeedError(f"Time spec must be a string, got {spec!r}")

        if m := _RE_D.match(spec):
            day = self.today + timedelta(days=int(m[1]))
            return self.to_utc(day, int(m[2]), int(m[3]))

        if m := _RE_W.match(spec):
            day = self._monday() + timedelta(weeks=int(m[1]), days=WEEKDAYS.index(m[2]))
            return self.to_utc(day, int(m[3]), int(m[4]))

        if m := _RE_NEXT_WD.match(spec):
            wd, h, mi = WEEKDAYS.index(m[1]), int(m[2]), int(m[3])
            for offset in range(0, 8):
                day = self.today + timedelta(days=offset)
                if day.weekday() == wd:
                    candidate = self.to_utc(day, h, mi)
                    if candidate > self.now:
                        return candidate
            raise DemoSeedError(f"Could not resolve {spec!r}")

        if m := _RE_NEXT_T.match(spec):
            h, mi = int(m[1]), int(m[2])
            for offset in range(0, 3):
                candidate = self.to_utc(self.today + timedelta(days=offset), h, mi)
                if candidate > self.now:
                    return candidate
            raise DemoSeedError(f"Could not resolve {spec!r}")

        if m := _RE_NEXT_DOM.match(spec):
            dom, h, mi = int(m[1]), int(m[2]), int(m[3])
            if not 1 <= dom <= 28:
                raise DemoSeedError(f"Day of month must be 1-28 in {spec!r}")
            first = self.today.replace(day=1)
            for months in range(0, 3):
                month = first + relativedelta(months=months)
                candidate = self.to_utc(month.replace(day=dom), h, mi)
                if candidate > self.now:
                    return candidate
            raise DemoSeedError(f"Could not resolve {spec!r}")

        raise DemoSeedError(f"Unrecognised time spec {spec!r}")

    def resolve_date(self, spec) -> date:
        if not isinstance(spec, str):
            raise DemoSeedError(f"Date spec must be a string, got {spec!r}")
        if m := _RE_DATE_D.match(spec):
            return self.today + timedelta(days=int(m[1]))
        if m := _RE_DATE_W.match(spec):
            return self._monday() + timedelta(weeks=int(m[1]), days=WEEKDAYS.index(m[2]))
        raise DemoSeedError(f"Unrecognised date spec {spec!r}")


def step_back(value: datetime, repeat_by: str, n: int) -> datetime:
    """The same arithmetic as app.utils.task_utils.update_date, run backwards."""
    if repeat_by == "daily":
        return value - timedelta(days=n)
    if repeat_by == "weekly":
        return value - timedelta(weeks=n)
    if repeat_by == "monthly":
        return value - relativedelta(months=n)
    return value - relativedelta(years=n)


# --------------------------------------------------------------------------- #
# Fixture -> resolved rows
# --------------------------------------------------------------------------- #


@dataclass
class Row:
    title: str
    description: str | None
    category: str
    start_at: datetime
    end_at: datetime
    created_at: datetime
    completed_at: datetime | None = None
    repeat_by: str | None = None
    repeat_until: date | None = None
    # Index (into Dataset.rows) of the recurring master a history row belongs to.
    master: int | None = None

    @property
    def is_history(self) -> bool:
        return self.master is not None

    @property
    def is_master(self) -> bool:
        return self.repeat_by is not None


@dataclass
class Dataset:
    first_name: str
    last_name: str
    rows: list[Row] = field(default_factory=list)
    brief_text: str = ""
    brief_date: date = field(default_factory=date.today)


def load_fixture(path: Path = FIXTURE_PATH) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        raise DemoSeedError(f"Cannot read fixture {path}: {e}")


def _require_keys(obj: dict, allowed: set, where: str):
    unknown = {k for k in obj if not k.startswith("_")} - allowed
    if unknown:
        raise DemoSeedError(f"Unknown key(s) {sorted(unknown)} in {where}")


def _task_label(item: dict, index: int) -> str:
    return f"tasks[{index}] ({item.get('title', '?')})"


def resolve(fixture: dict, now: datetime, brief_date: date | None = None) -> Dataset:
    """Validate the fixture and turn it into concrete rows. Does not touch the DB.

    `now` is naive UTC.
    """
    if not isinstance(fixture, dict):
        raise DemoSeedError("Fixture must be a JSON object")
    _require_keys(fixture, TOP_LEVEL_KEYS, "fixture")
    if fixture.get("fixture_version") != FIXTURE_VERSION:
        raise DemoSeedError(f"Unsupported fixture_version {fixture.get('fixture_version')!r}")

    try:
        tz = ZoneInfo(fixture.get("timezone", ""))
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        raise DemoSeedError(f"Unknown timezone {fixture.get('timezone')!r}")

    seed = fixture.get("seed")
    if not isinstance(seed, int):
        raise DemoSeedError("seed must be an integer")
    rng = random.Random(seed)

    user = fixture.get("user") or {}
    _require_keys(user, {"first_name", "last_name", "email"}, "user")
    if user.get("email") != DEMO_USER_EMAIL:
        raise DemoSeedError(f"user.email must be {DEMO_USER_EMAIL}")
    for key in ("first_name", "last_name"):
        if not isinstance(user.get(key), str) or not user[key].strip():
            raise DemoSeedError(f"user.{key} is required")

    brief = (fixture.get("daily_brief") or {}).get("markdown")
    if not isinstance(brief, str) or not brief.strip():
        raise DemoSeedError("daily_brief.markdown is required")

    clock = Clock(tz=tz, now=now)
    dataset = Dataset(
        first_name=user["first_name"].strip(),
        last_name=user["last_name"].strip(),
        brief_text=brief.strip(),
        brief_date=brief_date or clock.today,
    )

    items = fixture.get("tasks")
    if not isinstance(items, list):
        raise DemoSeedError("tasks must be a list")

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise DemoSeedError(f"tasks[{index}] must be an object")
        if all(k.startswith("_") for k in item):
            continue  # section marker / comment only
        _add_task(dataset, clock, rng, item, _task_label(item, index))

    return dataset


def _add_task(dataset: Dataset, clock: Clock, rng: random.Random, item: dict, where: str):
    _require_keys(item, TASK_KEYS, where)

    title = item.get("title")
    if not isinstance(title, str) or not title.strip() or len(title) > 255:
        raise DemoSeedError(f"{where}: title is required (max 255 characters)")
    if item.get("category") not in CATEGORIES:
        raise DemoSeedError(f"{where}: invalid category {item.get('category')!r}")
    description = item.get("description")
    if description is not None and not isinstance(description, str):
        raise DemoSeedError(f"{where}: description must be a string")
    mins = item.get("mins")
    if not isinstance(mins, int) or isinstance(mins, bool) or mins <= 0:
        raise DemoSeedError(f"{where}: mins must be a positive integer")

    start_spec = item.get("start")
    start = clock.resolve_datetime(start_spec)
    end = start + timedelta(minutes=mins)

    repeat = item.get("repeat")
    history = item.get("history")
    if history is not None and repeat is None:
        raise DemoSeedError(f"{where}: history is only allowed with repeat")

    repeat_by = None
    repeat_until = None
    if repeat is not None:
        _require_keys(repeat, {"by", "until"}, f"{where}.repeat")
        repeat_by = repeat.get("by")
        if repeat_by not in REPEAT_BY:
            raise DemoSeedError(f"{where}: repeat.by must be one of {sorted(REPEAT_BY)}")
        if repeat.get("until") is not None:
            repeat_until = clock.resolve_date(repeat["until"])
            start_day = start.replace(tzinfo=timezone.utc).astimezone(clock.tz).date()
            if repeat_until < start_day:
                raise DemoSeedError(f"{where}: repeat.until is before the first occurrence")

    done = clock.resolve_datetime(item["done"]) if item.get("done") else None
    if done is not None and done > clock.now:
        raise DemoSeedError(f"{where}: done is in the future")

    # A pending master is the next occurrence; only an explicit "D-n" may be in the past
    # (a deliberately missed occurrence).
    if repeat is not None and done is None and start <= clock.now:
        if not str(start_spec).startswith("D"):
            raise DemoSeedError(f"{where}: pending recurring task starts in the past")

    history_rows = _expand_history(clock, rng, history, start, mins, repeat_by, where)

    if item.get("created"):
        created = clock.resolve_datetime(item["created"])
    elif history_rows:
        created = history_rows[0].completed_at  # newest history row, as handle_repeat_task does
    else:
        raise DemoSeedError(f"{where}: created is required")

    if done is not None and done <= created:
        raise DemoSeedError(f"{where}: done must be after created")

    master_index = len(dataset.rows)
    dataset.rows.append(
        Row(
            title=title.strip(),
            description=description.strip() if description else None,
            category=item["category"],
            start_at=start,
            end_at=end,
            created_at=created,
            completed_at=done,
            repeat_by=repeat_by,
            repeat_until=repeat_until,
        )
    )
    for h in history_rows:
        h.title = title.strip()
        h.description = description.strip() if description else None
        h.category = item["category"]
        h.master = master_index
        dataset.rows.append(h)


def _expand_history(clock, rng, history, master_start, mins, repeat_by, where) -> list[Row]:
    """Completed past occurrences, newest first, shaped like handle_repeat_task's output."""
    if history is None:
        return []
    _require_keys(history, HISTORY_KEYS, f"{where}.history")

    n_values = history.get("n")
    if (
        not isinstance(n_values, list)
        or not n_values
        or any(not isinstance(n, int) or isinstance(n, bool) or n < 1 for n in n_values)
        or len(set(n_values)) != len(n_values)
    ):
        raise DemoSeedError(f"{where}: history.n must be a list of unique positive integers")

    done_after = history.get("done_after_min", 30)
    jitter = history.get("jitter_min", 0)
    if not isinstance(done_after, int) or not isinstance(jitter, int) or jitter < 0:
        raise DemoSeedError(f"{where}: done_after_min / jitter_min must be integers")
    series_created = clock.resolve_datetime(history.get("series_created"))

    rows: list[Row] = []
    for n in sorted(n_values):
        start = step_back(master_start, repeat_by, n)
        done = start + timedelta(minutes=done_after + rng.randint(-jitter, jitter))
        done = max(done, start + timedelta(minutes=1))
        if done > clock.now:
            done = clock.now - timedelta(minutes=1)
        if done <= start:
            continue  # occurrence only just started: treat as not completed yet
        rows.append(
            Row(
                title="",
                description=None,
                category="",
                start_at=start,
                end_at=start + timedelta(minutes=mins),
                created_at=series_created,  # fixed up below
                completed_at=done,
            )
        )

    if not rows:
        raise DemoSeedError(f"{where}: no history rows could be generated")

    # The app sets created_at = "now" on the master at every completion, so a history row
    # was created when the previous (older) occurrence was completed.
    for newer, older in zip(rows, rows[1:]):
        newer.created_at = older.completed_at
    rows[-1].created_at = series_created
    return rows


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #


def reset_demo_account(dataset: Dataset, now: datetime, confirm_db: str, out=print) -> dict:
    """Replace the demo user's data with `dataset`. Returns per-table counts."""
    from sqlalchemy import delete, func, select, text
    from werkzeug.security import generate_password_hash

    from app.database import SessionLocal, engine
    from app.models import (
        DailyBrief,
        Notification,
        NotificationSubscription,
        PasswordReset,
        RefreshToken,
        Task,
        User,
    )

    with engine.connect() as probe:
        db_name = probe.execute(text("SELECT DATABASE()")).scalar()
    out(f"Target database: {engine.url.host}/{db_name}")
    if db_name != confirm_db:
        raise DemoSeedError(
            f"--confirm-db {confirm_db!r} does not match the connected database {db_name!r}",
            EXIT_WRONG_DB,
        )

    # Advisory lock on a dedicated connection so it survives the work transaction.
    lock_conn = engine.connect()
    try:
        if lock_conn.execute(text("SELECT GET_LOCK(:n, 0)"), {"n": LOCK_NAME}).scalar() != 1:
            raise DemoSeedError("Another demo reset is already running", EXIT_LOCKED)

        session = SessionLocal()
        try:
            user = session.execute(
                select(User).where(User.email == DEMO_USER_EMAIL).with_for_update()
            ).scalar_one_or_none()

            if user is None:
                user = User(
                    first_name=dataset.first_name,
                    last_name=dataset.last_name,
                    email=DEMO_USER_EMAIL,
                    # Random and discarded: nobody can ever log in with a password.
                    password_hash=generate_password_hash(secrets.token_urlsafe(48)),
                    is_demo=True,
                )
                session.add(user)
            elif not user.is_demo:
                raise DemoSeedError(
                    f"{DEMO_USER_EMAIL} belongs to a real account; refusing to touch it",
                    EXIT_REAL_ACCOUNT,
                )
            else:
                user.first_name = dataset.first_name
                user.last_name = dataset.last_name
            session.flush()
            demo_id = user.id

            def scoped_delete(model, *extra):
                # Every delete is pinned to the demo user's id.
                return session.execute(
                    delete(model).where(model.user_id == demo_id, *extra)
                ).rowcount

            counts = {
                "notifications": scoped_delete(Notification),
                "notification_subscriptions": scoped_delete(NotificationSubscription),
                "daily_briefs": scoped_delete(DailyBrief),
                "password_resets": scoped_delete(PasswordReset),
                "tasks": scoped_delete(Task),
                # Live sessions are kept so a reset does not log visitors out.
                "refresh_tokens (expired)": scoped_delete(
                    RefreshToken, RefreshToken.expires_at < now
                ),
            }

            tasks = [
                Task(
                    title=r.title,
                    description=r.description,
                    category=r.category,
                    start_at=r.start_at,
                    end_at=r.end_at,
                    created_at=r.created_at,
                    completed_at=r.completed_at,
                    is_completed=r.completed_at is not None,
                    is_repeating=r.is_master,
                    repeat_by=r.repeat_by,
                    repeat_until=r.repeat_until,
                    user_id=demo_id,
                )
                for r in dataset.rows
            ]
            session.add_all(tasks)
            session.flush()
            for row, task in zip(dataset.rows, tasks):
                task.series_id = tasks[row.master].id if row.is_history else task.id
            session.add(
                DailyBrief(
                    user_id=demo_id,
                    brief_text=dataset.brief_text,
                    generated_date=dataset.brief_date,
                )
            )
            session.flush()

            stored = session.execute(
                select(func.count()).select_from(Task).where(Task.user_id == demo_id)
            ).scalar()
            master_ids = {t.id for t, r in zip(tasks, dataset.rows) if r.is_master}
            problems = []
            if stored != len(dataset.rows):
                problems.append(f"expected {len(dataset.rows)} tasks, found {stored}")
            for t, r in zip(tasks, dataset.rows):
                if r.completed_at is not None and r.completed_at > now:
                    problems.append(f"{r.title!r} is completed in the future")
                if r.is_history and t.series_id not in master_ids:
                    problems.append(f"{r.title!r} points at a missing series")
            if problems:
                raise DemoSeedError("; ".join(problems), EXIT_POSTCONDITION)

            session.commit()
        except BaseException:
            session.rollback()
            raise
        finally:
            session.close()
    finally:
        try:
            lock_conn.execute(text("SELECT RELEASE_LOCK(:n)"), {"n": LOCK_NAME})
        finally:
            lock_conn.close()

    counts["tasks inserted"] = len(dataset.rows)
    return counts


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def describe(dataset: Dataset) -> str:
    lines = []
    for r in dataset.rows:
        kind = "history" if r.is_history else "master" if r.is_master else "task"
        status = f"done {r.completed_at:%Y-%m-%d %H:%M}" if r.completed_at else "pending"
        lines.append(
            f"{kind:<8} {r.start_at:%Y-%m-%d %H:%M} -> {r.end_at:%H:%M}  "
            f"{r.category:<10} {status:<22} {r.title}"
        )
    return "\n".join(lines)


def parse_now(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Reset the shared demo account.")
    parser.add_argument("--fixture", type=Path, default=FIXTURE_PATH)
    parser.add_argument("--now", help="ISO 8601 time to treat as now (UTC if naive)")
    parser.add_argument("--dry-run", action="store_true", help="validate and print only")
    parser.add_argument(
        "--confirm-db",
        help="name of the database to write to; must match the connected database",
    )
    args = parser.parse_args(argv)

    try:
        now = parse_now(args.now)
        brief_date = date.today() if not args.now else now.date()
        dataset = resolve(load_fixture(args.fixture), now, brief_date)

        masters = sum(r.is_master for r in dataset.rows)
        history = sum(r.is_history for r in dataset.rows)
        summary = (
            f"{len(dataset.rows)} tasks ({masters} recurring masters, {history} history rows), "
            f"daily brief for {dataset.brief_date}"
        )

        if args.dry_run:
            print(describe(dataset))
            print(f"\nDry run: {summary}")
            return 0

        if not args.confirm_db:
            raise DemoSeedError("--confirm-db is required unless --dry-run is used", EXIT_WRONG_DB)

        counts = reset_demo_account(dataset, now, args.confirm_db)
        print(f"Demo account reset: {summary}")
        for name, value in counts.items():
            print(f"  {name}: {value}")
        return 0
    except DemoSeedError as e:
        print(f"Demo seed failed: {e}", file=sys.stderr)
        return e.code


if __name__ == "__main__":
    sys.exit(main())
