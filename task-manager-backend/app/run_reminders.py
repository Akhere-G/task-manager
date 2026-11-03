import json
import logging
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from pywebpush import WebPushException, webpush
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import INBOX_NAME
from app.database import SessionLocal
from app.models import (
    Notification,
    NotificationSubscription,
    Project,
    Task,
    TaskReminder,
)
from app.utils.dates import utc_now
from app.utils.reminders import reminder_title

load_dotenv()

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS: dict[str, str | int] = {"sub": "mailto:101akhere5@gmail.com"}

REMINDER_GRACE = timedelta(hours=1)
PUSH_TIMEOUT_SECONDS = 10


def reminder_body(task: Task, project_name: str) -> str:
    if task.description:
        return f"{project_name} -- {task.description}"
    return project_name


def _project_name(session: Session, task: Task) -> str:
    if task.project_id is None:
        return INBOX_NAME
    project = session.get(Project, task.project_id)
    return project.name if project else INBOX_NAME


def send_push_to_user_subscription(
    session: Session, user_id: int, title: str, message: str
) -> int:
    db_notif = Notification(user_id=user_id, title=title, message=message)
    session.add(db_notif)
    session.commit()

    stmt = select(NotificationSubscription).where(
        NotificationSubscription.user_id == user_id
    )
    subscriptions = session.execute(stmt).scalars().all()

    payload = json.dumps({"title": title, "message": message})

    total_subscriptions = 0

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS,
                timeout=PUSH_TIMEOUT_SECONDS,
            )
            total_subscriptions += 1
        except WebPushException as ex:
            logger.warning("Push to subscription %s failed: %s", sub.id, ex)
            if ex.response is not None and ex.response.status_code in [404, 410]:
                session.delete(sub)
                session.commit()
        except Exception as ex:
            logger.warning(
                "Push to subscription %s failed: %s", sub.id, type(ex).__name__
            )

    return total_subscriptions


def _due_reminders(session: Session, now: datetime) -> list[tuple[TaskReminder, Task]]:
    stmt = (
        select(TaskReminder, Task)
        .join(Task, Task.id == TaskReminder.task_id)
        .where(
            Task.is_completed.is_(False),
            Task.is_deleted.is_(False),
            Task.parent_id.is_(None),
            Task.start_at >= now,
            TaskReminder.fire_at <= now,
            TaskReminder.fire_at > now - REMINDER_GRACE,
            or_(
                TaskReminder.fired_for_start_at.is_(None),
                TaskReminder.fired_for_start_at != Task.start_at,
            ),
        )
    )
    return [(reminder, task) for reminder, task in session.execute(stmt)]


def check_task_reminders() -> None:
    session = SessionLocal()
    try:
        now = utc_now()
        due = _due_reminders(session, now)

        total_notifications = 0
        for reminder, task in due:
            try:
                total_notifications += send_push_to_user_subscription(
                    session=session,
                    user_id=task.user_id,
                    title=reminder_title(
                        task.title,
                        reminder.kind,
                        task.start_at,
                        now,
                        reminder.zone_name,
                    ),
                    message=reminder_body(task, _project_name(session, task)),
                )
                reminder.fired_for_start_at = task.start_at
                session.commit()
            except Exception:
                session.rollback()
                logger.exception("Could not send reminder %s", reminder.id)

        logger.info(
            "%s due reminder(s), %s push(es) sent", len(due), total_notifications
        )
    finally:
        session.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        check_task_reminders()
    except Exception:
        logger.exception("run_reminders failed")
        raise
