from collections.abc import Iterator

import pytest
from alembic import command

import migrate
from tests.db import connect


@pytest.fixture
def at_head(clean_tables: None) -> Iterator[None]:
    yield
    command.upgrade(migrate._config(), "head")


def table_names() -> set[str]:
    connection = connect()
    cursor = connection.cursor()
    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    names = {row[0] for row in cursor.fetchall()}
    connection.close()
    return names


def test_the_api_tokens_table_is_added_and_removed(at_head: None) -> None:
    command.downgrade(migrate._config(), "0013")
    assert "api_tokens" not in table_names()

    command.upgrade(migrate._config(), "head")

    assert "api_tokens" in table_names()


def test_deleting_a_user_deletes_their_tokens(at_head: None) -> None:
    connection = connect()
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) "
        "VALUES ('T', 'U', 'a@example.com', 'x') RETURNING id"
    )
    user_id = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO api_tokens (user_id, name, token_hash, prefix, scope) "
        "VALUES (%s, 'laptop', %s, 'tm_abcde', 'read')",
        (user_id, "a" * 64),
    )

    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))

    cursor.execute("SELECT count(*) FROM api_tokens")
    assert cursor.fetchone()[0] == 0
    connection.close()
