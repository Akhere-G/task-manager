from collections.abc import Callable
from typing import Any

from flask import Flask
from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from app.database import db
from app.models import Notification, NotificationSubscription


def subscribe(client: FlaskClient, n: int = 1, **overrides: Any) -> TestResponse:
    body = {
        "endpoint": f"https://push.example/{n}",
        "keys": {"p256dh": "k", "auth": "a"},
    }
    body.update(overrides)
    return client.post("/api/notifications/subscribe", json=body)


def test_notifications_come_newest_first_and_can_be_paged(
    app: Flask, make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    user_id = make_user()
    session = login()
    with app.app_context():
        for n in range(1, 8):
            db.session.add(Notification(user_id=user_id, title=f"N{n}", message="m"))
        db.session.commit()

    first = session.get("/api/notifications?limit=3").get_json()
    assert [n["title"] for n in first] == ["N7", "N6", "N5"]
    older = session.get(
        f"/api/notifications?limit=3&before_id={first[-1]['id']}"
    ).get_json()
    assert [n["title"] for n in older] == ["N4", "N3", "N2"]
    assert session.get("/api/notifications?limit=1000").status_code == 400


def test_subscription_must_be_a_short_https_url(session: FlaskClient) -> None:
    assert subscribe(session, endpoint="http://push.example/1").status_code == 400
    assert (
        subscribe(session, endpoint="https://push.example/" + "x" * 500).status_code
        == 400
    )
    assert subscribe(session).status_code == 201


def test_demo_account_cannot_subscribe(
    client: FlaskClient, make_demo_user: Callable[[], int]
) -> None:
    make_demo_user()
    client.post("/api/auth/demo")
    assert subscribe(client).status_code == 403


def test_only_the_ten_newest_subscriptions_are_kept(
    app: Flask, session: FlaskClient
) -> None:
    for n in range(12):
        assert subscribe(session, n).status_code == 201
    with app.app_context():
        endpoints = {
            s.endpoint for s in db.session.query(NotificationSubscription).all()
        }
    assert len(endpoints) == 10
    assert "https://push.example/0" not in endpoints
    assert "https://push.example/11" in endpoints


def test_unsubscribe_only_removes_own_subscription(
    app: Flask, make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a, b = login("a@example.com"), login("b@example.com")
    subscribe(a)

    b.delete(
        "/api/notifications/subscribe", json={"endpoint": "https://push.example/1"}
    )
    with app.app_context():
        assert db.session.query(NotificationSubscription).count() == 1

    a.delete(
        "/api/notifications/subscribe", json={"endpoint": "https://push.example/1"}
    )
    with app.app_context():
        assert db.session.query(NotificationSubscription).count() == 0
