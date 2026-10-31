import json
import logging
import os
from datetime import timedelta

from dotenv import load_dotenv
from pywebpush import WebPushException, webpush
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Notification, NotificationSubscription, Task
from app.utils.dates import utc_now

load_dotenv()

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS: dict[str, str | int] = {"sub": "mailto:101akhere5@gmail.com"}

REMINDER_WINDOW = timedelta(minutes=30)
PUSH_TIMEOUT_SECONDS = 10


def reminder_body(task: Task) -> str:
    if task.description:
        return f"{task.category} -- {task.description}"
    return task.category


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


def check_task_reminders() -> None:
    session = SessionLocal()
    try:
        now = utc_now()

        stmt = select(Task).where(
            Task.is_completed.is_(False),
            Task.start_at >= now,
            Task.start_at <= now + REMINDER_WINDOW,
            or_(
                Task.reminded_for_start_at.is_(None),
                Task.reminded_for_start_at != Task.start_at,
            ),
        )
        upcoming_tasks = session.execute(stmt).scalars().all()

        total_notifications = 0
        for task in upcoming_tasks:
            try:
                minutes = int((task.start_at - now).total_seconds() // 60)
                suffix = "" if minutes == 1 else "s"
                total_notifications += send_push_to_user_subscription(
                    session=session,
                    user_id=task.user_id,
                    title=f"{task.title} starting in {minutes} minute{suffix}!",
                    message=reminder_body(task),
                )
                task.reminded_for_start_at = task.start_at
                session.commit()
            except Exception:
                session.rollback()
                logger.exception("Could not send the reminder for task %s", task.id)

        logger.info(
            "%s upcoming task(s), %s push(es) sent",
            len(upcoming_tasks),
            total_notifications,
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
