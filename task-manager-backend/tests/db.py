import psycopg
from psycopg import sql

from app.config import build_database_url

SCHEMA_TABLES = {"alembic_version"}
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def connect(database: str | None = None) -> psycopg.Connection:
    url = build_database_url().set(drivername="postgresql")
    if database is not None:
        url = url.set(database=database)
    return psycopg.connect(url.render_as_string(hide_password=False), autocommit=True)


def create_database(name: str) -> None:
    with connect("postgres") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,))
        if cursor.fetchone() is None:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))


def empty_tables(database: str) -> None:
    with connect(database) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = [
            sql.Identifier("public", row[0])
            for row in cursor.fetchall()
            if row[0] not in SCHEMA_TABLES
        ]
        if tables:
            cursor.execute(
                sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                    sql.SQL(", ").join(tables)
                )
            )
