from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import create_engine
from dotenv import load_dotenv

from app.config import build_database_url

load_dotenv()

DATABASE_URL = build_database_url()


ENGINE_OPTIONS = {
    "pool_size": 10,
    "max_overflow": 5,
    "pool_recycle": 280,
    "pool_pre_ping": True,
    "connect_args": {
        "connect_timeout": 10,
        "read_timeout": 30,
        "write_timeout": 30,
    },
}


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

engine = create_engine(DATABASE_URL, **ENGINE_OPTIONS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
