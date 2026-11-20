import os
from collections.abc import Iterable

from sqlalchemy.engine import URL, make_url

DB_REQUIRED = ["DATABASE_URL"]
APP_REQUIRED = ["JWT_SECRET_KEY", "FRONTEND_URL"]


def missing_env(names: Iterable[str]) -> list[str]:
    missing = []
    for name in names:
        value = os.getenv(name)
        if not value:
            missing.append(name)
    return missing


def require_env(names: Iterable[str]) -> None:
    missing = missing_env(names)
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )


def build_database_url() -> URL:
    require_env(DB_REQUIRED)
    return make_url(os.environ["DATABASE_URL"]).set(drivername="postgresql+psycopg")


AI_DAILY_LIMIT = 30
AI_DAILY_LIMIT_DEMO = 60
