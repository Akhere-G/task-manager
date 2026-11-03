import os
from collections.abc import Iterator

import pytest
from alembic import command

import migrate
from tests.db import connect


@pytest.fixture
def at_head(clean_tables: None) -> Iterator[None]:
    yield
    command.upgrade(migrate._config(), "head")


def test_existing_tasks_keep_newest_first_with_gaps_per_user(at_head: None) -> None:
    command.downgrade(migrate._config(), "0010")
    connection = connect(os.environ["DB_NAME"])
    cursor = connection.cursor()
    users = []
    for email in ("a@example.com", "b@example.com"):
        cursor.execute(
            "INSERT INTO users (first_name, last_name, email, password_hash) "
            "VALUES ('T', 'U', %s, 'x')",
            (email,),
        )
        users.append(cursor.lastrowid)
    rows = [
        (users[0], "old", "2026-03-01 09:00:00"),
        (users[0], "new", "2026-03-03 09:00:00"),
        (users[1], "other", "2026-03-02 09:00:00"),
    ]
    for user_id, title, created in rows:
        cursor.execute(
            "INSERT INTO tasks (user_id, title, created_at) VALUES (%s, %s, %s)",
            (user_id, title, created),
        )
    connection.commit()

    command.upgrade(migrate._config(), "head")

    cursor.execute("SELECT title, sort_order FROM tasks")
    orders = dict(cursor.fetchall())
    assert orders == {"new": 1024, "old": 2048, "other": 1024}
    connection.close()
