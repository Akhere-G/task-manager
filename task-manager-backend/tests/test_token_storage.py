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
