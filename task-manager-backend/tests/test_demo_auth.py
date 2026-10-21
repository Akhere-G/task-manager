"""API tests for demo login and the guards around the shared demo account."""

from datetime import datetime, timedelta, timezone

import pytest
from werkzeug.security import generate_password_hash

from app.demo import DEMO_USER_EMAIL
from app.demo.seed import load_fixture, reset_demo_account, resolve

AJAX = {"X-Requested-With": "XMLHttpRequest"}


def seed_demo(db_name):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    dataset = resolve(load_fixture(), now, now.date())
    reset_demo_account(dataset, now, db_name, out=lambda *_: None)


def register(client, email="real@example.com"):
    return client.post(
        "/api/auth/register",
        json={
            "firstName": "Real",
            "lastName": "Person",
            "email": email,
            "password": "Password123",
            "confirmPassword": "Password123",
        },
    )


def cookie_names(client):
    return {c.key for c in client._cookies.values()} if hasattr(client, "_cookies") else set()


def test_requires_the_ajax_header(client, clean_db):
    seed_demo(clean_db)
    assert client.post("/api/auth/demo").status_code == 400


def test_unseeded_demo_is_unavailable_not_broken(client):
    response = client.post("/api/auth/demo", headers=AJAX)
    assert response.status_code == 503
    assert "unavailable" in response.get_json()["errors"]["general"]


def test_demo_login_issues_the_normal_session(client, clean_db):
    seed_demo(clean_db)

    response = client.post("/api/auth/demo", headers=AJAX)

    assert response.status_code == 200
    user = response.get_json()["user"]
    assert user["isDemo"] is True and user["email"] == DEMO_USER_EMAIL
    set_cookies = " ".join(response.headers.getlist("Set-Cookie"))
    assert "access_token_cookie=" in set_cookies and "refresh_token=" in set_cookies
    assert "HttpOnly" in set_cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.get_json()["user"]["isDemo"] is True

    tasks = client.get("/api/tasks")
    assert tasks.status_code == 200 and tasks.get_json()["totalTasks"] > 100


def test_demo_session_can_refresh_and_keeps_the_short_lifetime(client, clean_db, raw_db):
    seed_demo(clean_db)
    client.post("/api/auth/demo", headers=AJAX)

    assert client.post("/api/auth/refresh").status_code == 200
    assert client.get("/api/auth/me").get_json()["user"]["isDemo"] is True

    cur = raw_db.cursor()
    cur.execute("SELECT expires_at FROM refresh_tokens")
    expiries = [r[0] for r in cur.fetchall()]
    cur.close()
    assert len(expiries) == 1  # rotated, not accumulated
    remaining = expiries[0] - datetime.now(timezone.utc).replace(tzinfo=None)
    assert timedelta(hours=23) < remaining <= timedelta(hours=24, seconds=1)


def test_real_users_keep_a_seven_day_session(client, clean_db, raw_db):
    assert register(client).status_code == 201
    cur = raw_db.cursor()
    cur.execute("SELECT expires_at FROM refresh_tokens")
    expires = cur.fetchone()[0]
    cur.close()
    remaining = expires - datetime.now(timezone.utc).replace(tzinfo=None)
    assert timedelta(days=6, hours=23) < remaining <= timedelta(days=7, seconds=1)


def test_does_not_replace_a_real_users_session(flask_app, client, clean_db):
    seed_demo(clean_db)
    assert register(client).status_code == 201

    response = client.post("/api/auth/demo", headers=AJAX)

    assert response.status_code == 409
    me = client.get("/api/auth/me").get_json()["user"]
    assert me["email"] == "real@example.com" and me["isDemo"] is False


def test_demo_account_cannot_be_logged_into_with_a_password(client, clean_db, raw_db):
    seed_demo(clean_db)
    cur = raw_db.cursor()
    cur.execute(
        "UPDATE users SET password_hash=%s WHERE email=%s",
        (generate_password_hash("Password123"), DEMO_USER_EMAIL),
    )
    raw_db.commit()
    cur.close()

    response = client.post("/api/auth/login", json={"email": DEMO_USER_EMAIL, "password": "Password123"})

    assert response.status_code == 400


def test_password_reset_is_skipped_for_the_demo_user(client, clean_db, raw_db):
    seed_demo(clean_db)

    response = client.post("/api/auth/request-password-reset", json={"email": DEMO_USER_EMAIL})

    assert response.status_code == 200
    cur = raw_db.cursor()
    cur.execute("SELECT COUNT(*) FROM password_resets")
    assert cur.fetchone()[0] == 0
    cur.close()


SUBSCRIPTION = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}


def test_demo_cannot_register_push_subscriptions(client, clean_db, raw_db):
    seed_demo(clean_db)
    client.post("/api/auth/demo", headers=AJAX)

    response = client.post("/api/notifications/subscribe", json=SUBSCRIPTION)

    assert response.status_code == 403
    cur = raw_db.cursor()
    cur.execute("SELECT COUNT(*) FROM notification_subscriptions")
    assert cur.fetchone()[0] == 0
    cur.close()


def test_real_users_can_still_subscribe(client, clean_db):
    register(client)
    assert client.post("/api/notifications/subscribe", json=SUBSCRIPTION).status_code == 201


def test_existing_auth_responses_are_unchanged_for_real_users(client, clean_db):
    assert register(client).status_code == 201

    login = client.post("/api/auth/login", json={"email": "real@example.com", "password": "Password123"})
    assert login.status_code == 200
    user = login.get_json()["user"]
    assert user["isDemo"] is False
    assert {"id", "firstName", "lastName", "email"} <= set(user)

    assert client.get("/api/auth/me").get_json()["user"]["isDemo"] is False
    assert client.post("/api/auth/refresh").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
