from alembic import command
from sqlalchemy import inspect

import migrate
from app.database import engine


def test_all_migrations_can_be_rolled_back_and_reapplied(clean_tables: None) -> None:
    config = migrate._config()
    try:
        command.downgrade(config, "base")
        assert inspect(engine).get_table_names() == ["alembic_version"]
    finally:
        command.upgrade(config, "head")

    indexes = inspect(engine).get_indexes("tasks")
    search_index = next(
        index for index in indexes if index["name"] == "idx_tasks_search"
    )
    assert search_index["dialect_options"]["postgresql_using"] == "gin"
