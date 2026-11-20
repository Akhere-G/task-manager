from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def add_token(session: FlaskClient, **extra: Any) -> dict[str, Any]:
    body = {"name": "laptop", "scope": "read", **extra}
    response = session.post("/api/api-tokens", json=body)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_tokens_can_be_created_listed_and_revoked(session: FlaskClient) -> None:
    created = add_token(session, scope="write")
    assert created["token"].startswith("tm_")
    assert created["scope"] == "write"

    listed = session.get("/api/api-tokens").get_json()["tokens"]
    assert [t["id"] for t in listed] == [created["id"]]
    assert "token" not in listed[0]
    assert listed[0]["prefix"] == created["token"][: len(listed[0]["prefix"])]

    assert session.delete(f"/api/api-tokens/{created['id']}").status_code == 200
    assert session.get("/api/api-tokens").get_json()["tokens"] == []


def test_a_blank_name_or_unknown_scope_is_rejected(session: FlaskClient) -> None:
    blank = session.post("/api/api-tokens", json={"name": " ", "scope": "read"})
    assert blank.status_code == 400
    unknown = session.post("/api/api-tokens", json={"name": "a", "scope": "admin"})
    assert unknown.status_code == 400
    missing = session.post("/api/api-tokens", json={"name": "a"})
    assert missing.status_code == 400


def test_tokens_are_private_to_their_owner(
    make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    token = add_token(a)

    assert b.get("/api/api-tokens").get_json()["tokens"] == []
    assert b.delete(f"/api/api-tokens/{token['id']}").status_code == 404
    assert len(a.get("/api/api-tokens").get_json()["tokens"]) == 1


def test_the_demo_account_cannot_create_tokens(
    client: FlaskClient, make_demo_user: Callable[[], int]
) -> None:
    make_demo_user()
    client.post("/api/auth/demo")

    response = client.post("/api/api-tokens", json={"name": "a", "scope": "read"})

    assert response.status_code == 403


def test_tokens_require_login(client: FlaskClient) -> None:
    assert client.get("/api/api-tokens").status_code == 401
    assert client.post("/api/api-tokens", json={}).status_code == 401
