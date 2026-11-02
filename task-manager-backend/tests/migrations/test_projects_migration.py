from collections.abc import Iterator

import pytest
from alembic import command

import migrate
from tests.db import connect

BEFORE = "0005"


@pytest.fixture
def before_projects(clean_tables: None) -> Iterator[None]:
    command.downgrade(migrate._config(), BEFORE)
    yield
    command.upgrade(migrate._config(), "head")


def _add_user(cursor, email: str) -> int:
    cursor.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) "
        "VALUES ('T', 'U', %s, 'x')",
        (email,),
    )
    return cursor.lastrowid


def _add_task(
    cursor, user_id: int, category: str, completed: bool = False, deleted: bool = False
) -> int:
    cursor.execute(
        "INSERT INTO tasks (user_id, title, category, start_at, end_at, "
        "is_completed, is_deleted) "
        "VALUES (%s, 't', %s, '2026-03-02 10:00:00', '2026-03-02 11:00:00', %s, %s)",
        (user_id, category, completed, deleted),
    )
    return cursor.lastrowid


def _projects(cursor, user_id: int) -> dict[str, int]:
    cursor.execute("SELECT name, id FROM projects WHERE user_id = %s", (user_id,))
    return dict(cursor.fetchall())


def _project_of(cursor, task_id: int) -> str | None:
    cursor.execute(
        "SELECT p.name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id "
        "WHERE t.id = %s",
        (task_id,),
    )
    return cursor.fetchone()[0]


def test_each_user_gets_a_project_for_every_category_they_use(
    before_projects: None,
) -> None:
    import os

    connection = connect(os.environ["DB_NAME"])
    cursor = connection.cursor()
    ann, bob, nobody = (_add_user(cursor, f"{n}@example.com") for n in "abn")
    open_work = _add_task(cursor, ann, "work")
    done_health = _add_task(cursor, ann, "health", completed=True)
    gone_errands = _add_task(cursor, ann, "life-admin", deleted=True)
    bob_work = _add_task(cursor, bob, "General")
    bob_general = _add_task(cursor, bob, "general")

    command.upgrade(migrate._config(), "head")

    assert set(_projects(cursor, ann)) == {"Work", "Health", "Life admin"}
    assert set(_projects(cursor, bob)) == {"General"}
    assert _projects(cursor, nobody) == {}
    assert _project_of(cursor, open_work) == "Work"
    assert _project_of(cursor, done_health) == "Health"
    assert _project_of(cursor, gone_errands) == "Life admin"
    assert _project_of(cursor, bob_work) == _project_of(cursor, bob_general)
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE project_id IS NULL")
    assert cursor.fetchone()[0] == 0
    connection.close()


def test_downgrading_keeps_the_category_values(before_projects: None) -> None:
    import os

    connection = connect(os.environ["DB_NAME"])
    cursor = connection.cursor()
    user = _add_user(cursor, "a@example.com")
    task = _add_task(cursor, user, "work")
    command.upgrade(migrate._config(), "head")

    command.downgrade(migrate._config(), BEFORE)

    cursor.execute("SELECT category FROM tasks WHERE id = %s", (task,))
    assert cursor.fetchone()[0] == "work"
    connection.close()
