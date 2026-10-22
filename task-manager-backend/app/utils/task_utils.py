import re
from datetime import timedelta, datetime, date, timezone
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func, or_, text
from app.database import db
from app.models import Task
from dateutil import parser


MAX_SEARCH_LENGTH = 100
MAX_SEARCH_TERMS = 8
FULLTEXT_MIN_TERM_LENGTH = 3


def parse_search(search):
    cleaned = " ".join(str(search or "").split())[:MAX_SEARCH_LENGTH]
    terms = re.findall(r"\w+", cleaned)[:MAX_SEARCH_TERMS]
    if not terms:
        return None
    if all(len(term) >= FULLTEXT_MIN_TERM_LENGTH for term in terms):
        return "fulltext", " ".join(f"+{term}*" for term in terms)
    return "like", cleaned


def build_search_clause(search):
    plan = parse_search(search)
    if plan is None:
        return None

    mode, value = plan
    if mode == "fulltext":
        table = Task.__tablename__
        return text(
            f"MATCH({table}.title, {table}.description) "
            "AGAINST(:search IN BOOLEAN MODE)"
        ).bindparams(search=value)

    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Task.title.like(pattern, escape="\\"),
        Task.description.like(pattern, escape="\\"),
    )


def build_task_filters(
    user_id,
    category=None,
    search=None,
    is_completed=None,
    start_date=None,
    end_date=None,
    duration=None,
):
    clauses = [Task.user_id == user_id]

    if category and category != "all":
        clauses.append(Task.category == category)

    search_clause = build_search_clause(search)
    if search_clause is not None:
        clauses.append(search_clause)

    if is_completed is not None and is_completed != "all":
        val = True if str(is_completed).lower() == "true" else False
        clauses.append(Task.is_completed == val)

    if start_date and end_date:
        start_dt = datetime.combine(
            parser.isoparse(str(start_date)).date(), datetime.min.time()
        )
        end_dt = datetime.combine(
            parser.isoparse(str(end_date)).date(), datetime.max.time()
        )
        clauses.append(Task.end_at.between(start_dt, end_dt))

    if duration in ["short_tasks", "long_tasks"]:
        diff = func.timestampdiff(
            func.literal_column("MINUTE"), Task.start_at, Task.end_at
        )
        if duration == "short_tasks":
            clauses.append(diff <= 30)
        else:
            clauses.append(diff > 30)

    return clauses


MAX_GHOSTS = 5000


def with_repeating(tasks, view_start, view_end, user_id, additional_clauses=None):
    ghost_count = 0
    view_start = view_start.replace(tzinfo=timezone.utc)
    view_end = view_end.replace(tzinfo=timezone.utc)
    clauses = [
        Task.user_id == user_id,
        Task.is_repeating,
        or_(Task.repeat_until.is_(None), Task.repeat_until >= view_start),
    ]

    if additional_clauses:
        clauses.extend(additional_clauses)

    repeating_tasks = db.session.execute(select(Task).where(*clauses)).scalars().all()

    for task in repeating_tasks:
        instance_start = task.start_at.replace(tzinfo=timezone.utc)
        instance_end = task.end_at.replace(tzinfo=timezone.utc)
        repeat_until = task.repeat_until
        task_start_at = task.start_at.replace(tzinfo=timezone.utc)

        if repeat_until and isinstance(repeat_until, date):
            repeat_until = datetime.combine(repeat_until, datetime.max.time()).replace(
                tzinfo=timezone.utc
            )
        if not repeat_until:
            repeat_until = view_end

        while instance_start < view_start:
            instance_start = update_date(instance_start, task.repeat_by)
            instance_end = update_date(instance_end, task.repeat_by)

            if repeat_until and instance_start >= repeat_until:
                break

        if task_start_at == instance_start:
            instance_start = update_date(instance_start, task.repeat_by)
            instance_end = update_date(instance_end, task.repeat_by)

        while instance_start <= view_end:
            if repeat_until and instance_start > repeat_until:
                break

            ghost_task = {
                "id": f"ghost_{task.id}_{instance_start.strftime('%Y%m%d')}",
                "title": task.title,
                "description": task.description,
                "category": task.category,
                "is_completed": task.is_completed,
                "start_at": instance_start,
                "end_at": instance_end,
                "created_at": task.created_at,
                "completed_at": task.completed_at,
                "is_repeating": task.is_repeating,
                "repeat_by": task.repeat_by,
                "repeat_until": task.repeat_until,
                "series_id": task.id,
                "user_id": task.user_id,
                "is_ghost": True,
            }
            tasks.append(ghost_task)
            ghost_count += 1
            if ghost_count >= MAX_GHOSTS:
                return tasks

            instance_start = update_date(instance_start, task.repeat_by)
            instance_end = update_date(instance_end, task.repeat_by)

    return tasks


def check_should_repeat(old_task, updated_task):
    if (
        updated_task.get("is_repeating")
        and updated_task.get("is_completed")
        and not old_task.get("is_completed")
    ):
        repeat_until_val = updated_task.get("repeat_until")

        if isinstance(repeat_until_val, str):
            repeat_until_val = datetime.strptime(repeat_until_val, "%Y-%m-%d").date()
        if isinstance(repeat_until_val, date):
            repeat_until_val = datetime.combine(repeat_until_val, datetime.max.time())

        start_at = updated_task.get("start_at")

        if isinstance(start_at, str):
            start_at = parser.isoparse(start_at)

        next_start = update_date(start_at, updated_task.get("repeat_by"))

        return not repeat_until_val or repeat_until_val >= next_start
    return False


def handle_repeat_task(user_id, original_task):
    history_task = Task(
        title=original_task["title"],
        description=original_task["description"],
        category=original_task["category"],
        start_at=original_task["start_at"],
        end_at=original_task["end_at"],
        is_repeating=False,
        user_id=user_id,
        series_id=original_task["id"],
        is_completed=True,
        completed_at=original_task["completed_at"] or datetime.now(timezone.utc),
        created_at=original_task["created_at"],
    )
    db.session.add(history_task)

    next_start = update_date(original_task["start_at"], original_task["repeat_by"])
    next_end = update_date(original_task["end_at"], original_task["repeat_by"])

    current_task = db.session.execute(
        select(Task).where(Task.id == original_task["id"])
    ).scalar_one_or_none()

    if current_task:
        current_task.start_at = next_start
        current_task.end_at = next_end
        current_task.is_completed = False
        current_task.completed_at = None
        current_task.series_id = current_task.id
        current_task.created_at = datetime.now(timezone.utc)

    db.session.commit()


def update_date(old_date, repeat_by):
    if repeat_by == "daily":
        return old_date + timedelta(days=1)
    if repeat_by == "weekly":
        return old_date + timedelta(weeks=1)
    if repeat_by == "monthly":
        return old_date + relativedelta(months=1)
    if repeat_by == "yearly":
        return old_date + relativedelta(years=1)
    return old_date + timedelta(days=1)
