import pytest

from app.database import db
from app.models import Notification


@pytest.fixture
def session(make_user, login):
    make_user()
    return login()


def subscribe(client, n=1, **overrides):
    body = {"endpoint": f"https://push.example/{n}", "keys": {"p256dh": "k", "auth": "a"}}
    body.update(overrides)
    return client.post("/api/notifications/subscribe", json=body)


def test_notifications_are_listed_newest_first_with_a_page_limit(app, make_user, login):
    user_id = make_user()
    session = login()
    with app.app_context():
        for n in range(1, 4):
            db.session.add(Notification(user_id=user_id, title=f"N{n}", message="m"))
        db.session.commit()

    listed = session.get("/api/notifications?limit=2").get_json()
    assert [n["title"] for n in listed] == ["N3", "N2"]
    assert session.get("/api/notifications?limit=1000").status_code == 400


def test_a_notification_can_be_marked_read(app, make_user, login):
    user_id = make_user()
    session = login()
    with app.app_context():
        note = Notification(user_id=user_id, title="Hi", message="m")
        db.session.add(note)
        db.session.commit()
        note_id = note.id

    assert session.patch(f"/api/notifications/{note_id}/read").get_json()["is_read"] is True


def test_subscription_must_be_a_short_https_url(session):
    assert subscribe(session, endpoint="http://push.example/1").status_code == 400
    assert subscribe(session, endpoint="https://push.example/" + "x" * 500).status_code == 400
    assert subscribe(session).status_code == 201


def test_demo_account_cannot_subscribe(client, make_demo_user):
    make_demo_user()
    client.post("/api/auth/demo")
    assert subscribe(client).status_code == 403


def test_unsubscribe_removes_the_subscription(session):
    subscribe(session)
    response = session.delete(
        "/api/notifications/subscribe", json={"endpoint": "https://push.example/1"}
    )
    assert response.status_code == 200
