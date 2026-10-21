"""The migration script must work on fresh and existing databases, and be re-runnable."""

import os

import pytest

from tests.conftest import DB_CONFIGURED, DB_NAME, local_connect_without_tls, raw_connection

pytestmark = pytest.mark.skipif(not DB_CONFIGURED, reason="needs a *_test database")

MIGRATION_DB = f"{DB_NAME}_migrate_test"

OLD_USERS = """
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
)
"""


def run_init_db(monkeypatch):
    import init_db

    monkeypatch.setenv("DB_NAME", MIGRATION_DB)
    monkeypatch.setattr(
        init_db.mysql.connector,
        "connect",
        local_connect_without_tls(init_db.mysql.connector.connect),
    )
    init_db.initialise_database()


def q(sql, params=()):
    conn = raw_connection(MIGRATION_DB)
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def reset_database(create_old_users=False):
    conn = raw_connection()
    cur = conn.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {MIGRATION_DB}")
    if create_old_users:
        cur.execute(f"CREATE DATABASE {MIGRATION_DB}")
        cur.execute(f"USE {MIGRATION_DB}")
        cur.execute(OLD_USERS)
        cur.execute(
            "INSERT INTO users (first_name,last_name,email,password_hash) VALUES ('Old','User','old@example.com','x')"
        )
    conn.commit()
    cur.close()
    conn.close()


def assert_fully_migrated():
    default, nullable = q(
        "SELECT COLUMN_DEFAULT, IS_NULLABLE FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=%s AND TABLE_NAME='users' AND COLUMN_NAME='is_demo'",
        (MIGRATION_DB,),
    )[0]
    assert str(default if not isinstance(default, bytes) else default.decode()) == "0"
    assert nullable == "NO"
    assert q(
        "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS "
        "WHERE TABLE_SCHEMA=%s AND TABLE_NAME='tasks' AND INDEX_NAME='idx_tasks_search'",
        (MIGRATION_DB,),
    ) == [(1,)]
    assert q(
        "SELECT COUNT(*) FROM information_schema.TRIGGERS "
        "WHERE TRIGGER_SCHEMA=%s AND TRIGGER_NAME='tr_ensure_completion_timestamp'",
        (MIGRATION_DB,),
    ) == [(1,)]


def test_fresh_database(monkeypatch):
    reset_database()
    run_init_db(monkeypatch)
    assert_fully_migrated()


def test_existing_database_without_the_column_gains_it(monkeypatch):
    reset_database(create_old_users=True)

    run_init_db(monkeypatch)

    assert_fully_migrated()
    assert q("SELECT email, is_demo FROM users") == [("old@example.com", 0)]


def test_can_be_run_repeatedly(monkeypatch, capsys):
    reset_database()
    for _ in range(3):
        run_init_db(monkeypatch)
    assert_fully_migrated()
    assert "FAILED" not in capsys.readouterr().out
