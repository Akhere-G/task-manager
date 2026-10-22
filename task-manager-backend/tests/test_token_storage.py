import hashlib
from datetime import datetime, timedelta, timezone
from unittest import mock


import app.routes.auth_routes as auth_routes
import init_db
from tests.conftest import DEFAULT_PASSWORD, _connection


def rows(sql, params=()):
    import os

    conn = _connection()
    with conn.cursor() as cur:
        cur.execute(f"USE `{os.environ['DB_NAME']}`")
        cur.execute(sql, params)
        result = cur.fetchall()
    conn.close()
    return result


def test_refresh_token_is_stored_as_a_hash(make_user, login):
    make_user()
    session = login()
    cookie = session.get_cookie("refresh_token").value

    stored = rows("SELECT token, token_hash FROM refresh_tokens")
    assert len(stored) == 1
    assert stored[0][0] is None
    assert stored[0][1] == hashlib.sha256(cookie.encode()).hexdigest()


def test_reset_token_is_stored_as_a_hash(client, make_user):
    make_user()
    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        client.post("/api/auth/request-password-reset", json={"email": "user@example.com"})
    token = send.call_args[0][2]

    stored = rows("SELECT token, token_hash FROM password_resets")
    assert stored[0][0] is None
    assert stored[0][1] == hashlib.sha256(token.encode()).hexdigest()


def test_password_reset_revokes_existing_sessions(client, make_user, login):
    make_user()
    other_device = login()
    stale_cookie = other_device.get_cookie("refresh_token").value

    with mock.patch.object(auth_routes, "send_password_reset_email") as send:
        client.post("/api/auth/request-password-reset", json={"email": "user@example.com"})
    token = send.call_args[0][2]
    done = client.post("/api/auth/reset-password", json={"token": token, "password": "Another-pass7"})
    assert done.status_code == 200

    assert rows("SELECT COUNT(*) FROM refresh_tokens")[0][0] == 0
    client.set_cookie("refresh_token", stale_cookie)
    assert client.post("/api/auth/refresh").status_code == 401


def test_existing_plaintext_rows_are_migrated_and_keep_working(client, make_user):
    import os

    user_id = make_user()
    plaintext = "legacy-token-value"
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)
    conn = _connection()
    with conn.cursor() as cur:
        cur.execute(f"USE `{os.environ['DB_NAME']}`")
        cur.execute(
            "INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES (%s, %s, NULL, %s)",
            (user_id, plaintext, expires),
        )
    conn.close()

    init_db.initialise_database()
    init_db.initialise_database()

    stored = rows("SELECT token_hash FROM refresh_tokens WHERE token = %s", (plaintext,))
    assert stored[0][0] == hashlib.sha256(plaintext.encode()).hexdigest()

    client.set_cookie("refresh_token", plaintext)
    assert client.post("/api/auth/refresh").status_code == 200


def test_missing_refresh_cookie_is_unauthorised(client):
    assert client.post("/api/auth/refresh").status_code == 401


def insert_session(user_id, token_hash, expires):
    import os

    conn = _connection()
    with conn.cursor() as cur:
        cur.execute(f"USE `{os.environ['DB_NAME']}`")
        cur.execute(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user_id, token_hash, expires),
        )
    conn.close()


def naive_utc(delta):
    return datetime.now(timezone.utc).replace(tzinfo=None) + delta


def test_login_removes_expired_sessions_but_keeps_valid_ones(make_user, login):
    a = make_user("a@example.com")
    b = make_user("b@example.com")
    insert_session(a, "a" * 64, naive_utc(-timedelta(days=1)))
    insert_session(a, "b" * 64, naive_utc(timedelta(days=1)))
    insert_session(b, "c" * 64, naive_utc(-timedelta(days=2)))
    insert_session(b, "d" * 64, naive_utc(timedelta(days=2)))

    login("a@example.com")

    remaining = {row[0] for row in rows("SELECT token_hash FROM refresh_tokens")}
    assert "a" * 64 not in remaining
    assert "b" * 64 in remaining
    assert "c" * 64 not in remaining
    assert "d" * 64 in remaining


def test_purge_failure_does_not_block_login(app, make_user):
    make_user()
    client = app.test_client()
    with mock.patch.object(auth_routes, "purge_expired_sessions", side_effect=RuntimeError("db hiccup")):
        response = client.post(
            "/api/auth/login", json={"email": "user@example.com", "password": DEFAULT_PASSWORD}
        )
    assert response.status_code == 200


def test_demo_sessions_keep_their_24_hour_lifetime(client, make_demo_user):
    make_demo_user()
    assert client.post("/api/auth/demo").status_code == 200
    expires = rows("SELECT expires_at FROM refresh_tokens")[0][0]
    remaining = expires - naive_utc(timedelta(0))
    assert timedelta(hours=23) < remaining <= timedelta(hours=24, seconds=1)


def test_session_lookups_use_the_unique_token_hash_index(make_user):
    insert_session(make_user(), "x" * 64, naive_utc(timedelta(days=1)))
    plan = rows(
        "EXPLAIN FORMAT=TRADITIONAL SELECT id FROM refresh_tokens WHERE token_hash = %s",
        ("x" * 64,),
    )
    assert "uq_refresh_tokens_token_hash" in str(plan)
