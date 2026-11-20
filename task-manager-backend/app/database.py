from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import build_database_url

load_dotenv()

DATABASE_URL = build_database_url()


def build_connect_args() -> dict[str, int]:
    return {"connect_timeout": 10}


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
