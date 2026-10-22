from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import create_engine
from dotenv import load_dotenv

from app.config import build_database_url

load_dotenv()

DATABASE_URL = build_database_url()


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

engine = create_engine(
    DATABASE_URL, pool_size=10, pool_recycle=280, pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
