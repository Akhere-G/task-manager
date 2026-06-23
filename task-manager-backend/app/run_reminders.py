from datetime import datetime, timedelta
from sqlalchemy import select
from pywebpush import webpush, WebPushException
from app.models import Task, Notification, NotificationSubscription
from app.database import SessionLocal
import json
import os
from dotenv import load_dotenv
from typing import Dict

load_dotenv()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS: Dict[str, str | int] = {"sub": "mailto:101akhere5@gmail.com"}


def send_push_to_user_subscription(session, user_id, title, message):
    db_notif = Notification(user_id=user_id, title=title, message=message)
    session.add(db_notif)
    session.commit()

    stmt = select(NotificationSubscription).where(
        NotificationSubscription.user_id == user_id
    )
    subscriptions = session.execute(stmt).scalars().all()

    payload = json.dumps({"title": title, "message": message})

    print(f"{len(subscriptions)} (s) subscriptions")

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
            )
            total_subscriptions += 1
        except WebPushException as ex:
            import traceback

            print("CRITICAL ERROR IN SCHEDULER, could not push notifications:")
            print(traceback.format_exc())
            if ex.response is not None and ex.response.status_code in [404, 410]:
                session.delete(sub)
                session.commit()
            raise ex
    return total_subscriptions


def check_task_reminders():
    session = SessionLocal()
    try:
        now = datetime.now()
        fifteen_minutes_ahead = now + timedelta(minutes=15)

        print(f"Current time: {now}. In fifteen minutes: {fifteen_minutes_ahead}")

        stmt = select(Task).where(
            Task.start_at >= now, Task.start_at <= fifteen_minutes_ahead
        )

        upcoming_tasks = session.execute(stmt).scalars().all()

        print(f"{len(upcoming_tasks)} upcoming task(s)")

        total_notifications = 0
        for task in upcoming_tasks:
            time = int((task.start_at - now).seconds / 60)
            suffix = "s" if not time == 1 else ""
            notifications = send_push_to_user_subscription(
                session=session,
                user_id=task.user_id,
                title=f"{task.title} starting in {time} minute{suffix}!",
                message=f"{task.category} -- {task.description}",
            )
            total_notifications += notifications
        print(f"Sent {total_notifications} notification(s)")
    finally:
        session.close()


if __name__ == "__main__":
    print("--- Starting run_reminders.py ---")
    try:
        check_task_reminders()
        print("--- run_reminders.py finished successfully ---")
    except Exception as e:
        import traceback

        print(f"--- run_reminders.py failed: {e} ---")

        print("CRITICAL ERROR IN RUN_REMINDER:")
        print(traceback.format_exc())
        raise e
