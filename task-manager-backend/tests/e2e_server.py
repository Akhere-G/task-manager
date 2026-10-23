"""Start the API for the Playwright end-to-end tests.

    python -m tests.e2e_server        (from task-manager-backend)

It only ever talks to a local MySQL server and only to the `task_manager_e2e`
database, which it creates and empties on start. Every setting is passed through
the environment explicitly so a developer's .env (which may point at a real
database or real AI keys) is never used.

The AI providers are replaced with a deterministic stub, so no request ever leaves the machine.

Connection settings: E2E_DB_HOST (default 127.0.0.1), E2E_DB_PORT (3306),
E2E_DB_USER (root), E2E_DB_PASSWORD (empty), E2E_API_PORT (5001).
"""

import os
import sys

E2E_DB_NAME = "task_manager_e2e"
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def configure_environment():
    host = os.environ.get("E2E_DB_HOST", "127.0.0.1")
    if host not in LOCAL_HOSTS:
        sys.exit(f"Refusing to run the E2E suite against a non-local database: {host}")

    os.environ.update(
        DB_HOST=host,
        DB_PORT=os.environ.get("E2E_DB_PORT", "3306"),
        DB_USER=os.environ.get("E2E_DB_USER", "root"),
        DB_PASSWORD=os.environ.get("E2E_DB_PASSWORD", ""),
        DB_NAME=E2E_DB_NAME,
        DB_SSL_CA="",
        JWT_SECRET_KEY="e2e-secret-key-for-the-test-suite-only",
        JWT_COOKIE_SECURE="False",
        FRONTEND_URL=os.environ.get("E2E_FRONTEND_URL", "http://localhost:5173"),
        REDIS_URL="",
        RATELIMIT_ENABLED="False",
        GEMINI_API_KEY="",
        GROQ_API_KEY="",
        MAIL_SEND_API_KEY="",
        MAIL_SEND_EMAIL="noreply@example.com",
        CONTACT_TO_EMAIL="owner@example.com",
    )


def reset_database():
    import pymysql

    import init_db

    connection = pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        autocommit=True,
    )
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{E2E_DB_NAME}`")
    connection.close()

    init_db.initialise_database()

    connection = pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=E2E_DB_NAME,
        autocommit=True,
    )
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        for table in tables:
            cursor.execute(f"TRUNCATE TABLE `{table}`")
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")
    connection.close()


def stub_ai_provider():
    import json

    from app.services import ai_service

    def generate(prompt):
        if "Extract task details" in prompt:
            return json.dumps(
                {
                    "title": "Dentist appointment",
                    "description": None,
                    "category": "health",
                    "startAt": "2026-03-12 15:00",
                    "endAt": "2026-03-12 16:00",
                    "isRepeating": False,
                    "repeatBy": None,
                    "repeatUntil": None,
                }
            )
        if "Decompose this task" in prompt:
            return json.dumps(
                [
                    {
                        "title": f"Step {n}",
                        "description": None,
                        "category": "work",
                        "startAt": "2026-03-12 09:00:00",
                        "endAt": "2026-03-12 10:00:00",
                    }
                    for n in range(1, 4)
                ]
            )
        return "Start with your most important task."

    ai_service.get_generated_text = generate


if __name__ == "__main__":
    configure_environment()
    reset_database()

    from app.main import create_app

    stub_ai_provider()

    create_app().run(
        host="127.0.0.1",
        port=int(os.environ.get("E2E_API_PORT", "5001")),
        use_reloader=False,
        threaded=True,
    )
