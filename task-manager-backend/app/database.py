from typing import Any

from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import build_database_url, ssl_ca_path

load_dotenv()

DATABASE_URL = build_database_url()


def build_connect_args() -> dict[str, Any]:
    args = {"connect_timeout": 10, "read_timeout": 30, "write_timeout": 30}
    ca = ssl_ca_path()
    if ca:
        args["ssl"] = {"ca": ca}  # type: ignore
    return args


ENGINE_OPTIONS = {
    "pool_size": 10,
    "max_overflow": 5,
    "pool_recycle": 280,
    "pool_pre_ping": True,
    "connect_args": build_connect_args(),
}


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

engine = create_engine(DATABASE_URL, **ENGINE_OPTIONS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
