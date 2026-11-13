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


def test_existing_projects_get_columns_and_tasks_are_sorted_into_them(
    at_head: None,
) -> None:
    command.downgrade(migrate._config(), "0011")
    connection = connect(os.environ["DB_NAME"])
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) "
        "VALUES ('T', 'U', 'a@example.com', 'x')"
    )
    user_id = cursor.lastrowid
    cursor.execute(
        "INSERT INTO projects (user_id, name) VALUES (%s, 'Work')", (user_id,)
    )
    project_id = cursor.lastrowid
    for title, is_completed in (("open", 0), ("finished", 1)):
        cursor.execute(
            "INSERT INTO tasks (user_id, project_id, title, is_completed) "
            "VALUES (%s, %s, %s, %s)",
            (user_id, project_id, title, is_completed),
        )
    cursor.execute(
        "INSERT INTO tasks (user_id, title) VALUES (%s, 'inbox')", (user_id,)
    )
    connection.commit()

    command.upgrade(migrate._config(), "head")

    cursor.execute(
        "SELECT name, on_drop FROM project_columns WHERE project_id = %s "
        "ORDER BY position",
        (project_id,),
    )
    assert list(cursor.fetchall()) == [
        ("To Do", "uncomplete"),
        ("In Progress", "uncomplete"),
        ("Done", "complete"),
    ]
    cursor.execute(
        "SELECT t.title, c.name FROM tasks t LEFT JOIN project_columns c "
        "ON c.id = t.column_id"
    )
    assert dict(cursor.fetchall()) == {
        "open": "To Do",
        "finished": "Done",
        "inbox": None,
    }
    connection.close()
