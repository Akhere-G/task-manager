import secrets
from datetime import datetime, timedelta
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

from app.database import db
from app.models import User, PasswordReset, RefreshToken


def create_user(first_name, last_name, email, password):
    hashed_password = generate_password_hash(password)
    new_user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hashed_password,
    )

    db.session.add(new_user)
    try:
        db.session.commit()
        return new_user.id
    except IntegrityError:
        db.session.rollback()
        return "EXISTS"


def login_user(email, password):
    user = db.session.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if user and check_password_hash(user.password_hash, password):
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }
    return None


def get_user(id=None, email=None):
    if not id and not email:
        return None

    stmt = select(User)
    if id:
        stmt = stmt.where(User.id == id)
    else:
        stmt = stmt.where(User.email == email)

    user = db.session.execute(stmt).scalar_one_or_none()
    if user:
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }
    return None


def create_reset_token(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(minutes=15)

    db.session.execute(delete(PasswordReset).where(PasswordReset.user_id == user_id))

    reset_entry = PasswordReset(user_id=user_id, token=token, expires_at=expires_at)
    db.session.add(reset_entry)
    db.session.commit()
    return token


def verify_reset_token(token):
    result = db.session.execute(
        select(PasswordReset).where(
            PasswordReset.token == token, PasswordReset.expires_at > datetime.now()
        )
    ).scalar_one_or_none()

    return result.user_id if result else None


def update_password_and_clear_token(user_id, token, new_password):
    user = db.session.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if not user:
        return False

    user.password_hash = generate_password_hash(new_password)
    db.session.execute(delete(PasswordReset).where(PasswordReset.token == token))
    db.session.commit()
    return True


def validate_refresh_token(refresh_token):
    user = db.session.execute(
        select(User)
        .join(RefreshToken, User.id == RefreshToken.user_id)
        .where(
            RefreshToken.token == refresh_token,
            RefreshToken.expires_at > datetime.now(),
        )
    ).scalar_one_or_none()

    if user:
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }
    return None


def delete_refresh_token(refresh_token):
    db.session.execute(delete(RefreshToken).where(RefreshToken.token == refresh_token))
    db.session.commit()


def create_session(user_id):
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now() + timedelta(days=7)

    session_entry = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.session.add(session_entry)
    db.session.commit()
    return token


def rotate_refresh_token(old_token, user_id):
    delete_refresh_token(old_token)
    return create_session(user_id)
