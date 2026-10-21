"""Test setup.

DB tests need a throwaway MySQL database whose name ends in `_test`, supplied through the
environment (never read from .env), e.g.

    DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD= DB_NAME=taskflow_test pytest

Tests that need the database are skipped when it is not configured, and refuse to run
against any database whose name does not end in `_test`.
"""

import os

# Set before anything imports app.database, so load_dotenv() can never fill these from a
# real .env (it does not override variables that are already set).
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-production-use-0123456789")
os.environ.setdefault("DB_PASSWORD", "")
for _name, _default in (("DB_HOST", "127.0.0.1"), ("DB_PORT", "3306"), ("DB_USER", "root")):
    os.environ.setdefault(_name, _default)
_db_name_from_env = os.environ.get("DB_NAME", "")
os.environ.setdefault("DB_NAME", "not_configured")
os.environ["JWT_COOKIE_SECURE"] = "False"

from datetime import datetime, timezone  # noqa: E402

import mysql.connector  # noqa: E402
import pytest  # noqa: E402

DB_NAME = os.environ["DB_NAME"]
DB_CONFIGURED = bool(_db_name_from_env) and DB_NAME.endswith("_test")

TABLES = [
    "notification_subscriptions",
    "notifications",
    "daily_briefs",
    "password_resets",
    "refresh_tokens",
    "tasks",
    "users",
]


def raw_connection(database=None):
    return mysql.connector.connect(
        host=os.environ["DB_HOST"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=int(os.environ["DB_PORT"]),
        database=database,
    )


def local_connect_without_tls(real_connect):
    """init_db.py insists on TLS with a bundled CA; a local throwaway server has neither."""

    def connect(**kwargs):
        for key in ("ssl_ca", "ssl_verify_cert"):
            kwargs.pop(key, None)
        return real_connect(**kwargs)

    return connect


@pytest.fixture(scope="session")
def db_schema():
    """Fresh schema built by the real init_db.py, so tests run on production DDL."""
    if not DB_CONFIGURED:
        pytest.skip("Set DB_* env vars with DB_NAME ending in _test to run database tests")

    conn = raw_connection()
    cur = conn.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME}")
    conn.commit()
    cur.close()
    conn.close()

    import init_db

    real_connect = init_db.mysql.connector.connect
    init_db.mysql.connector.connect = local_connect_without_tls(real_connect)
    try:
        init_db.initialise_database()
    finally:
        init_db.mysql.connector.connect = real_connect
    return DB_NAME


@pytest.fixture
def clean_db(db_schema):
    conn = raw_connection(db_schema)
    cur = conn.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")
    for table in TABLES:
        cur.execute(f"TRUNCATE TABLE {table}")
    cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()
    cur.close()
    conn.close()
    yield db_schema


@pytest.fixture
def raw_db(clean_db):
    conn = raw_connection(clean_db)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def flask_app(db_schema):
    from app.main import create_app

    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(flask_app, clean_db):
    return flask_app.test_client()


def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)
