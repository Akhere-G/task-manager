from tests.conftest import DEFAULT_PASSWORD


def register(client, email="new@example.com"):
    return client.post(
        "/api/auth/register",
        json={
            "firstName": "New",
            "lastName": "Person",
            "email": email,
            "password": DEFAULT_PASSWORD,
            "confirmPassword": DEFAULT_PASSWORD,
        },
    )


def test_register_sets_session_and_me_works(client):
    response = register(client)
    assert response.status_code == 201
    assert client.get_cookie("access_token_cookie") is not None
    assert client.get_cookie("refresh_token") is not None

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["user"]["email"] == "new@example.com"


def test_register_duplicate_email_rejected(client):
    assert register(client).status_code == 201
    assert register(client).status_code == 400


def test_login_wrong_password_rejected(client, make_user):
    make_user()
    response = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": "nope-nope1"}
    )
    assert response.status_code == 400


def test_login_unknown_email_rejected(client):
    response = client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "nope-nope1"}
    )
    assert response.status_code == 400


def test_me_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401


def test_demo_account_cannot_use_password_login(client, make_demo_user):
    make_demo_user()
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@taskflow.invalid", "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 400


def test_demo_login_issues_session(client, make_demo_user):
    make_demo_user()
    response = client.post("/api/auth/demo")
    assert response.status_code == 200
    assert response.get_json()["user"]["isDemo"] is True


def test_refresh_rotates_token(make_user, login):
    make_user()
    session = login()
    old = session.get_cookie("refresh_token").value

    response = session.post("/api/auth/refresh")
    assert response.status_code == 200
    assert session.get_cookie("refresh_token").value != old


def test_old_token_still_works_briefly_but_does_not_rotate_again(app, make_user, login):
    make_user()
    session = login()
    old = session.get_cookie("refresh_token").value
    session.post("/api/auth/refresh")
    current = session.get_cookie("refresh_token").value

    other_tab = app.test_client()
    other_tab.set_cookie("refresh_token", old)
    response = other_tab.post("/api/auth/refresh")
    assert response.status_code == 200
    assert other_tab.get_cookie("refresh_token").value == old
    assert any(c.startswith("access_token_cookie=") for c in response.headers.getlist("Set-Cookie"))
    assert not any(c.startswith("refresh_token=") for c in response.headers.getlist("Set-Cookie"))

    assert session.post("/api/auth/refresh").status_code == 200
    assert current != session.get_cookie("refresh_token").value


def test_old_token_is_rejected_after_the_grace_window(app, make_user, login):
    from datetime import datetime, timedelta, timezone

    from app.database import db
    from app.models import RefreshToken
    from app.services.auth_service import hash_token

    make_user()
    session = login()
    old = session.get_cookie("refresh_token").value
    session.post("/api/auth/refresh")

    with app.app_context():
        row = db.session.query(RefreshToken).filter_by(token_hash=hash_token(old)).one()
        row.replaced_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=30)
        db.session.commit()

    other_tab = app.test_client()
    other_tab.set_cookie("refresh_token", old)
    assert other_tab.post("/api/auth/refresh").status_code == 401


def test_expired_refresh_token_is_rejected(app, make_user, login):
    from datetime import datetime, timedelta, timezone

    from app.database import db
    from app.models import RefreshToken

    make_user()
    session = login()
    with app.app_context():
        row = db.session.query(RefreshToken).one()
        row.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
        db.session.commit()
    assert session.post("/api/auth/refresh").status_code == 401


def test_parallel_refreshes_with_the_same_cookie_all_succeed(app, make_user, login):
    from concurrent.futures import ThreadPoolExecutor

    make_user()
    session = login()
    token = session.get_cookie("refresh_token").value

    def refresh(_):
        client = app.test_client()
        client.set_cookie("refresh_token", token)
        response = client.post("/api/auth/refresh")
        rotated = any(c.startswith("refresh_token=") for c in response.headers.getlist("Set-Cookie"))
        return response.status_code, rotated

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(refresh, range(4)))

    assert all(status == 200 for status, _ in results)
    assert sum(1 for _, rotated in results if rotated) == 1


def test_logout_invalidates_refresh_token(client, make_user, login):
    make_user()
    session = login()
    token = session.get_cookie("refresh_token").value
    assert session.post("/api/auth/logout").status_code == 200

    client.set_cookie("refresh_token", token)
    assert client.post("/api/auth/refresh").status_code == 401


def test_common_password_rejected_on_register(client):
    response = client.post(
        "/api/auth/register",
        json={
            "firstName": "A",
            "lastName": "B",
            "email": "a@example.com",
            "password": "Password1",
            "confirmPassword": "Password1",
        },
    )
    assert response.status_code == 400
    assert "password" in response.get_json()["errors"]
