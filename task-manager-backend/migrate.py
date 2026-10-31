import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

from app.config import build_database_url
from app.database import build_connect_args

load_dotenv()

BASELINE = "0001"


def _config() -> Config:
    root = Path(__file__).resolve().parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    return config


def _existing_tables() -> set[str]:
    engine = create_engine(build_database_url(), connect_args=build_connect_args())
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def run() -> None:
    config = _config()
    tables = _existing_tables()
    # Databases built by the old init_db.py have the baseline schema but no
    # version table; adopt them instead of re-creating the tables.
    if "users" in tables and "alembic_version" not in tables:
        command.stamp(config, BASELINE)
    command.upgrade(config, "head")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
