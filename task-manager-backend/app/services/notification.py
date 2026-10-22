from sqlalchemy import delete, select
from ..models import Notification, NotificationSubscription
from ..database import db


MAX_SUBSCRIPTIONS_PER_USER = 10


def get_notifications(user_id: int, limit: int = 50, before_id: int | None = None):
    stmt = select(Notification).where(Notification.user_id == user_id)
    if before_id is not None:
        stmt = stmt.where(Notification.id < before_id)
    stmt = stmt.order_by(Notification.id.desc()).limit(limit)
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
    subscription = db.session.execute(stmt).scalar_one_or_none()

    if subscription:
        subscription.user_id = user_id
        subscription.p256dh = p256dh
        subscription.auth = auth
    else:
        subscription = NotificationSubscription(
            user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth
        )
        db.session.add(subscription)
    db.session.flush()

    keep = (
        select(NotificationSubscription.id)
        .where(NotificationSubscription.user_id == user_id)
        .order_by(NotificationSubscription.id.desc())
        .limit(MAX_SUBSCRIPTIONS_PER_USER)
    )
    keep_ids = list(db.session.execute(keep).scalars())
    db.session.execute(
        delete(NotificationSubscription).where(
            NotificationSubscription.user_id == user_id,
            NotificationSubscription.id.not_in(keep_ids),
        )
    )
    db.session.commit()
    db.session.refresh(subscription)

    return subscription


def delete_subscription(user_id: int, endpoint: str):
    db.session.execute(
        delete(NotificationSubscription).where(
            NotificationSubscription.user_id == user_id,
            NotificationSubscription.endpoint == endpoint,
        )
    )
    db.session.commit()
