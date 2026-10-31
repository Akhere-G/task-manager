import os

import pymysql

SCHEMA_TABLES = {"alembic_version"}


def connect(database: str | None = None) -> pymysql.connections.Connection:
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=database,
        autocommit=True,
    )


def create_database(name: str) -> None:
    connection = connect()
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{name}`")
    connection.close()


def empty_tables(database: str) -> None:
    connection = connect(database)
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall() if row[0] not in SCHEMA_TABLES]
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        for table in tables:
            cursor.execute(f"TRUNCATE TABLE `{table}`")
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")
    connection.close()
