"""Start the API for the Playwright end-to-end tests.

    python -m tests.e2e_server        (from task-manager-backend)

It only talks to a local PostgreSQL server and only to the `task_manager_e2e` database,
which it migrates and empties on every start. The database, secrets and AI settings
are set explicitly, so a developer's .env cannot point it at a real database or real
AI keys (other .env keys still load), and the AI providers are replaced with a
deterministic stub.

Connection settings: E2E_DATABASE_URL (defaults to local PostgreSQL),
E2E_API_PORT (5001).
"""

import json
import os
import sys

from sqlalchemy.engine import make_url

from tests.db import LOCAL_HOSTS, create_database, empty_tables

E2E_DB_NAME = "task_manager_e2e"


def configure_environment() -> None:
    url = make_url(
        os.environ.get(
            "E2E_DATABASE_URL",
            "postgresql://postgres:postgres@127.0.0.1:5432/task_manager_e2e",
        )
    )
    if url.host not in LOCAL_HOSTS or url.database != E2E_DB_NAME:
        sys.exit("Refusing to run E2E outside a local task_manager_e2e database")

    os.environ.update(
        DATABASE_URL=url.render_as_string(hide_password=False),
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


def reset_database() -> None:
    # Imported late: app modules read the environment set by configure_environment.
    import migrate

    create_database(E2E_DB_NAME)
    migrate.run()
    empty_tables(E2E_DB_NAME)


def _stub_reply(prompt: str) -> str:
    if "Extract task details" in prompt:
        return json.dumps(
            {
                "title": "Dentist appointment",
                "project": "Health",
                "startAt": "2026-03-12 15:00",
                "endAt": "2026-03-12 16:00",
            }
        )
    if "Decompose this task" in prompt:
        steps = [
            {
                "title": f"Step {n}",
                "startAt": "2026-03-12 09:00:00",
                "endAt": "2026-03-12 10:00:00",
            }
            for n in range(1, 4)
        ]
        return json.dumps(steps)
    return "Start with your most important task."


if __name__ == "__main__":
    configure_environment()
    reset_database()

    from app.main import create_app
    from app.services import ai_service

    ai_service.get_generated_text = _stub_reply
    create_app().run(
        host="127.0.0.1",
        port=int(os.environ.get("E2E_API_PORT", "5001")),
        use_reloader=False,
        threaded=True,
    )
