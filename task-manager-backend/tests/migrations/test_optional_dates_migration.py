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


def test_downgrading_gives_undated_tasks_dates_and_upgrading_keeps_them(
    at_head: None,
) -> None:
    connection = connect(os.environ["DB_NAME"])
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) "
        "VALUES ('T', 'U', 'm@example.com', 'x')"
    )
    user_id = cursor.lastrowid
    cursor.execute(
        "INSERT INTO tasks (user_id, title, created_at) "
        "VALUES (%s, 'someday', '2026-03-02 10:00:00')",
        (user_id,),
    )
    connection.commit()

    command.downgrade(migrate._config(), "0007")
    cursor.execute("SELECT start_at, end_at FROM tasks WHERE title = 'someday'")
    start, end = cursor.fetchone()
    assert str(start) == "2026-03-02 10:00:00"
    assert str(end) == "2026-03-02 10:30:00"

    command.upgrade(migrate._config(), "head")
    cursor.execute(
        "INSERT INTO tasks (user_id, title) VALUES (%s, 'again')", (user_id,)
    )
    connection.commit()
    cursor.execute("SELECT start_at FROM tasks WHERE title = 'again'")
    assert cursor.fetchone()[0] is None
    connection.close()
