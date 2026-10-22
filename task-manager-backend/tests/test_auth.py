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


def test_refresh_rotates_token(client, make_user, login):
    make_user()
    session = login()
    old = session.get_cookie("refresh_token").value

    response = session.post("/api/auth/refresh")
    assert response.status_code == 200
    new = session.get_cookie("refresh_token").value
    assert new != old

    stale = client.post("/api/auth/refresh")
    assert stale.status_code == 401
    client.set_cookie("refresh_token", old)
    assert client.post("/api/auth/refresh").status_code == 401


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
