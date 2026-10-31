import os
from collections.abc import Callable, Iterator
from typing import Any

from flask import Flask

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "task_manager_test")
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-the-test-suite-only"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["JWT_COOKIE_SECURE"] = "False"
os.environ["TRUSTED_PROXY_HOPS"] = "1"
os.environ["REDIS_URL"] = ""
os.environ["MAIL_SEND_API_KEY"] = "test-key"
os.environ["MAIL_SEND_EMAIL"] = "noreply@example.com"
os.environ["CONTACT_TO_EMAIL"] = "owner@example.com"

import pytest
from flask.testing import FlaskClient
from werkzeug.security import generate_password_hash

import migrate
from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.extensions import limiter
from app.main import create_app
from app.models import User
from tests.db import create_database, empty_tables

DEFAULT_PASSWORD = "Sturdy-pass9"
DEFAULT_PASSWORD_HASH = generate_password_hash(DEFAULT_PASSWORD)

TEST_TYPE_BY_LAYER = {
    "utils": "unit",
    "schemas": "unit",
    "models": "integration",
    "services": "integration",
    "routes": "functional",
    "security": "security",
}
TEST_TYPES = {*TEST_TYPE_BY_LAYER.values(), "property"}


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        layer_type = TEST_TYPE_BY_LAYER.get(item.path.parent.name)
        has_type = any(item.get_closest_marker(name) for name in TEST_TYPES)
        if layer_type and not has_type:
            item.add_marker(layer_type)


@pytest.fixture(scope="session")
def database() -> None:
    create_database(os.environ["DB_NAME"])
    migrate.run()


class AjaxClient(FlaskClient):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.environ_base["HTTP_X_REQUESTED_WITH"] = "XMLHttpRequest"


@pytest.fixture(scope="session")
def flask_app(database: None) -> Flask:
    app = create_app()
    app.test_client_class = AjaxClient
    return app


@pytest.fixture
def clean_tables(database: None) -> None:
    empty_tables(os.environ["DB_NAME"])


@pytest.fixture
def app(flask_app: Flask, clean_tables: None) -> Flask:
    return flask_app


@pytest.fixture(autouse=True)
def reset_rate_limits() -> Iterator[None]:
    if limiter.initialized:
        limiter.reset()
    yield


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()


def _password_hash(password: str) -> str:
    if password == DEFAULT_PASSWORD:
        return DEFAULT_PASSWORD_HASH
    return generate_password_hash(password)


@pytest.fixture
def make_user(app: Flask) -> Callable[..., int]:
    def _make_user(
        email: str = "user@example.com",
        password: str = DEFAULT_PASSWORD,
        is_demo: bool = False,
    ) -> int:
        with app.app_context():
            user = User(
                first_name="Test",
                last_name="User",
                email=email,
                password_hash=_password_hash(password),
                is_demo=is_demo,
            )
            db.session.add(user)
            db.session.commit()
            return user.id

    return _make_user


@pytest.fixture
def make_demo_user(make_user: Callable[..., int]) -> Callable[[], int]:
    return lambda: make_user(email=DEMO_USER_EMAIL, is_demo=True)


@pytest.fixture
def login(app: Flask) -> Callable[..., FlaskClient]:
    def _login(
        email: str = "user@example.com", password: str = DEFAULT_PASSWORD
    ) -> FlaskClient:
        client = app.test_client()
        response = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.get_json()
        return client

    return _login


@pytest.fixture
def session(
    make_user: Callable[..., int], login: Callable[..., FlaskClient]
) -> FlaskClient:
    make_user()
    return login()


@pytest.fixture
def task_payload() -> Callable[..., dict[str, Any]]:
    def _payload(**overrides: Any) -> dict[str, Any]:
        payload = {
            "title": "Write report",
            "description": "Quarterly numbers",
            "category": "work",
            "startAt": "2026-03-02 10:00:00",
            "endAt": "2026-03-02 11:00:00",
        }
        payload.update(overrides)
        return payload

    return _payload


@pytest.fixture
def app_context(app: Flask) -> Iterator[None]:
    with app.app_context():
        yield
        db.session.rollback()


@pytest.fixture
def user_id(make_user: Callable[..., int], app_context: None) -> int:
    return make_user()
