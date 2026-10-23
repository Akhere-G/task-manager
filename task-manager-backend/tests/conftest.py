import os

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ["DB_NAME"] = "task_manager_test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-the-test-suite-only"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["JWT_COOKIE_SECURE"] = "False"
os.environ["TRUSTED_PROXY_HOPS"] = "1"
os.environ["REDIS_URL"] = ""
os.environ["MAIL_SEND_API_KEY"] = "test-key"
os.environ["MAIL_SEND_EMAIL"] = "noreply@example.com"
os.environ["CONTACT_TO_EMAIL"] = "owner@example.com"

import pymysql
import pytest

from flask.testing import FlaskClient
from werkzeug.security import generate_password_hash

import init_db
from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.extensions import limiter
from app.main import create_app
from app.models import User

TABLES = [
    "notification_subscriptions",
    "notifications",
    "refresh_tokens",
    "password_resets",
    "daily_briefs",
    "tasks",
    "users",
]

DEFAULT_PASSWORD = "Sturdy-pass9"


def _connection():
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        autocommit=True,
    )


@pytest.fixture(scope="session", autouse=True)
def database():
    conn = _connection()
    with conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{os.environ['DB_NAME']}`")
    conn.close()
    init_db.initialise_database()


class AjaxClient(FlaskClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.environ_base["HTTP_X_REQUESTED_WITH"] = "XMLHttpRequest"


@pytest.fixture(scope="session")
def app(database):
    app = create_app()
    app.test_client_class = AjaxClient
    return app


@pytest.fixture(autouse=True)
def clean_tables(database):
    conn = _connection()
    with conn.cursor() as cur:
        cur.execute(f"USE `{os.environ['DB_NAME']}`")
        cur.execute("SET FOREIGN_KEY_CHECKS=0")
        for table in TABLES:
            cur.execute(f"TRUNCATE TABLE {table}")
        cur.execute("SET FOREIGN_KEY_CHECKS=1")
    conn.close()


@pytest.fixture(autouse=True)
def reset_rate_limits():
    if limiter.initialized:
        limiter.reset()
    yield


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    def _make_user(email="user@example.com", password=DEFAULT_PASSWORD, is_demo=False):
        with app.app_context():
            user = User(
                first_name="Test",
                last_name="User",
                email=email,
                password_hash=generate_password_hash(password),
                is_demo=is_demo,
            )
            db.session.add(user)
            db.session.commit()
            return user.id

    return _make_user


@pytest.fixture
def make_demo_user(make_user):
    return lambda: make_user(email=DEMO_USER_EMAIL, is_demo=True)


@pytest.fixture
def login(app):
    def _login(email="user@example.com", password=DEFAULT_PASSWORD):
        client = app.test_client()
        response = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.get_json()
        return client

    return _login


@pytest.fixture
def task_payload():
    def _payload(**overrides):
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
