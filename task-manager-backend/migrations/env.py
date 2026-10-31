from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

load_dotenv()

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.config import build_database_url
from app.database import Base, build_connect_args

config = context.config
target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=build_database_url().render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    engine = create_engine(
        build_database_url(),
        poolclass=pool.NullPool,
        connect_args=build_connect_args(),
    )
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
