import os
from pathlib import Path

from sqlalchemy.engine import URL

DB_REQUIRED = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
APP_REQUIRED = ["JWT_SECRET_KEY", "FRONTEND_URL"]

# A database password may legitimately be empty (local development), so for
# these variables being set is enough.
MAY_BE_EMPTY = {"DB_PASSWORD"}


def missing_env(names):
    missing = []
    for name in names:
        value = os.getenv(name)
        if value is None or (value == "" and name not in MAY_BE_EMPTY):
            missing.append(name)
    return missing


def require_env(names):
    missing = missing_env(names)
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )


def build_database_url():
    require_env(DB_REQUIRED)
    return URL.create(
        "mysql+pymysql",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT") or 3306),
        database=os.environ["DB_NAME"],
    )


def ssl_ca_path():
    configured = os.getenv("DB_SSL_CA")
    if not configured:
        return None
    path = Path(configured)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent / path
    if not path.is_file():
        raise RuntimeError("DB_SSL_CA does not point to an existing file")
    return str(path)

AI_DAILY_LIMIT = 30
AI_DAILY_LIMIT_DEMO = 60
