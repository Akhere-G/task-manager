from sqlalchemy import select
from ..models import Notification, NotificationSubscription
from ..database import db


def get_notifications(user_id: int):
    stmt = select(Notification).where(Notification.user_id == user_id)
    return db.session.execute(stmt).scalars()


def read_notifications(user_id: int, notification_id: int):
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user_id
    )
    notificaiton = db.session.execute(stmt).scalar_one_or_none()

    if not notificaiton:
        return None

    notificaiton.is_read = True

    db.session.commit()

    return notificaiton


def save_subscription(user_id: int, endpoint: str, p256dh: str, auth: str):
    stmt = select(NotificationSubscription).where(
        NotificationSubscription.endpoint == endpoint
    )
    existing_sub = db.session.execute(stmt).scalar_one_or_none()

    if existing_sub:
        existing_sub.user_id = user_id
        existing_sub.p256dh = p256dh
        existing_sub.auth = auth
        db.session.commit()
        db.session.refresh(existing_sub)
        return existing_sub

    new_sub = NotificationSubscription(
        user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth
    )
    db.session.add(new_sub)
    db.session.commit()
    db.session.refresh(new_sub)

    return new_sub
