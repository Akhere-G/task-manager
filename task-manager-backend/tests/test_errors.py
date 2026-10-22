from unittest import mock

import pytest

import app.routes.task_routes as task_routes


def test_unknown_api_route_returns_json_404(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.is_json
    assert "error" in response.get_json()


def test_spa_fallback_serves_index_for_non_api_paths(app, client, tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<html>spa</html>")
    monkeypatch.setattr(app, "static_folder", str(tmp_path))
    response = client.get("/some/spa/route")
    assert response.status_code == 200
    assert b"spa" in response.data
    assert client.get("/api/missing").status_code == 404


def test_missing_static_build_is_a_404_not_a_crash(client):
    assert client.get("/some/spa/route").status_code == 404


def test_wrong_method_returns_405_json(client, make_user, login):
    make_user()
    session = login()
    response = session.put("/api/tasks")
    assert response.status_code == 405
    assert response.is_json


@pytest.mark.parametrize(
    "path",
    ["/api/auth/login", "/api/auth/register", "/api/auth/request-password-reset", "/api/auth/reset-password"],
)
def test_malformed_json_returns_400_not_500(client, path):
    response = client.post(path, data="{not json", content_type="application/json")
    assert response.status_code == 400
    assert response.is_json


def test_non_object_body_returns_400(client, make_user, login):
    make_user()
    session = login()
    for path in ("/api/tasks", "/api/ai/parse-task", "/api/ai/decompose", "/api/notifications/subscribe"):
        response = session.post(path, json=[1, 2, 3])
        assert response.status_code == 400, path


def test_wrong_content_type_returns_400(client, make_user, login):
    make_user()
    session = login()
    response = session.post("/api/tasks", data="title=x", content_type="text/plain")
    assert response.status_code == 400


def test_bulk_rejects_non_object_items(client, make_user, login):
    make_user()
    session = login()
    response = session.post("/api/tasks/bulk", json=["a", "b"])
    assert response.status_code == 400


def test_unexpected_exception_is_generic_and_logged(client, make_user, login, caplog):
    make_user()
    session = login()
    with mock.patch.object(task_routes, "get_all_tasks", side_effect=RuntimeError("secret internal detail")):
        with caplog.at_level("ERROR"):
            response = session.get("/api/tasks")
    assert response.status_code == 500
    assert response.get_json() == {"error": "Internal server error"}
    assert "secret internal detail" not in response.get_data(as_text=True)
    assert "secret internal detail" in caplog.text


def test_missing_login_still_returns_401(client):
    assert client.get("/api/tasks").status_code == 401


def test_auth_routes_do_not_leak_exception_text(client, make_user):
    make_user()
    with mock.patch("app.routes.auth_routes.login_user", side_effect=RuntimeError("db password leaked")):
        response = client.post("/api/auth/login", json={"email": "user@example.com", "password": "Sturdy-pass9"})
    assert response.status_code == 500
    assert "leaked" not in response.get_data(as_text=True)
