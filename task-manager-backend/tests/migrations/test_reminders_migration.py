from collections.abc import Iterator

import pytest
from alembic import command

import migrate
from tests.db import connect


@pytest.fixture
def at_head(clean_tables: None) -> Iterator[None]:
    yield
    command.upgrade(migrate._config(), "head")


def test_open_dated_tasks_get_the_default_reminder_and_keep_their_fired_marker(
    at_head: None,
) -> None:
    command.downgrade(migrate._config(), "0009")
    connection = connect()
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) "
        "VALUES ('T', 'U', 'm@example.com', 'x') RETURNING id"
    )
    user_id = cursor.fetchone()[0]
    rows = [
        ("open", "2026-03-11 10:00:00", False, "2026-03-11 10:00:00"),
        ("done", "2026-03-11 11:00:00", True, None),
        ("undated", None, False, None),
    ]
    for title, start, completed, reminded in rows:
        end = start and "2026-03-11 12:00:00"
        cursor.execute(
            "INSERT INTO tasks (user_id, title, start_at, end_at, is_completed, "
            "reminded_for_start_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, title, start, end, completed, reminded),
        )
    connection.commit()

    command.upgrade(migrate._config(), "head")

    cursor.execute(
        "SELECT t.title, r.kind, r.minutes_before, r.fire_at, r.fired_for_start_at "
        "FROM task_reminders r JOIN tasks t ON t.id = r.task_id"
    )
    ((title, kind, minutes, fire_at, fired),) = cursor.fetchall()
    assert (title, kind, minutes) == ("open", "before", 30)
    assert str(fire_at) == "2026-03-11 09:30:00"
    assert str(fired) == "2026-03-11 10:00:00"
    connection.close()
