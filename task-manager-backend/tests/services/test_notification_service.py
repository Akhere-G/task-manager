import pytest

from app.database import db
from app.models import Notification, NotificationSubscription
from app.services import notification


@pytest.fixture
def user_id(app, make_user):
    with app.app_context():
        yield make_user()


def endpoints():
    return {s.endpoint for s in db.session.query(NotificationSubscription)}


def test_notifications_come_newest_first_and_can_be_paged(user_id):
    for n in range(1, 8):
        db.session.add(Notification(user_id=user_id, title=f"N{n}", message="m"))
    db.session.commit()

    first = list(notification.get_notifications(user_id, limit=3))
    assert [n.title for n in first] == ["N7", "N6", "N5"]
    older = notification.get_notifications(user_id, limit=3, before_id=first[-1].id)
    assert [n.title for n in older] == ["N4", "N3", "N2"]


def test_only_the_owner_can_mark_a_notification_read(user_id, make_user):
    other = make_user("other@example.com")
    note = Notification(user_id=user_id, title="Private", message="m")
    db.session.add(note)
    db.session.commit()

    assert notification.read_notifications(other, note.id) is None
    assert notification.read_notifications(user_id, note.id).is_read is True


def test_only_the_ten_newest_subscriptions_are_kept(user_id):
    for n in range(12):
        notification.save_subscription(user_id, f"https://push.example/{n}", "k", "a")

    kept = endpoints()
    assert len(kept) == 10
    assert "https://push.example/0" not in kept and "https://push.example/11" in kept


def test_resubscribing_an_endpoint_updates_it_instead_of_duplicating(user_id):
    notification.save_subscription(user_id, "https://push.example/1", "k1", "a1")
    notification.save_subscription(user_id, "https://push.example/1", "k2", "a2")

    row = db.session.query(NotificationSubscription).one()
    assert row.p256dh == "k2"


def test_unsubscribing_only_removes_the_callers_subscription(user_id, make_user):
    other = make_user("other@example.com")
    notification.save_subscription(user_id, "https://push.example/1", "k", "a")

    notification.delete_subscription(other, "https://push.example/1")
    assert len(endpoints()) == 1

    notification.delete_subscription(user_id, "https://push.example/1")
    assert endpoints() == set()
