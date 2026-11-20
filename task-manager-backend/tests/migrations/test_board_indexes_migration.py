from collections.abc import Iterator

import pytest
from alembic import command

import migrate
from tests.db import connect

BOARD_INDEXES = {"idx_tasks_user_column_order", "idx_tasks_user_priority_order"}


@pytest.fixture
def at_head(clean_tables: None) -> Iterator[None]:
    yield
    command.upgrade(migrate._config(), "head")


def task_indexes() -> set[str]:
    connection = connect()
    cursor = connection.cursor()
    cursor.execute(
        "SELECT indexname FROM pg_indexes "
        "WHERE schemaname = 'public' AND tablename = 'tasks'"
    )
    names = {row[0] for row in cursor.fetchall()}
    connection.close()
    return names


def test_the_board_indexes_are_added_and_removed(at_head: None) -> None:
    command.downgrade(migrate._config(), "0012")
    assert not BOARD_INDEXES & task_indexes()

    command.upgrade(migrate._config(), "head")

    assert task_indexes() >= BOARD_INDEXES
