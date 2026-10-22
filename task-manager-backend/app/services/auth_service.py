import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.models import User, PasswordReset, RefreshToken

SESSION_TTL = timedelta(days=7)
DEMO_SESSION_TTL = timedelta(hours=24)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _user_dict(user):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "is_demo": bool(user.is_demo),
    }


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


_DUMMY_PASSWORD_HASH = generate_password_hash("not-a-real-password")


def login_user(email, password):
    user = db.session.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if not user or user.is_demo:
        check_password_hash(_DUMMY_PASSWORD_HASH, password)
        return None

    if check_password_hash(user.password_hash, password):
        return _user_dict(user)
    return None


def get_demo_user():
    user = db.session.execute(
        select(User).where(User.is_demo.is_(True), User.email == DEMO_USER_EMAIL)
    ).scalar_one_or_none()
    return _user_dict(user) if user else None


def get_user(id=None, email=None):
    if not id and not email:
        return None

    stmt = select(User)
    if id:
        stmt = stmt.where(User.id == id)
    else:
        stmt = stmt.where(User.email == email)

    user = db.session.execute(stmt).scalar_one_or_none()
    return _user_dict(user) if user else None


def create_reset_token(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    db.session.execute(delete(PasswordReset).where(PasswordReset.user_id == user_id))

    reset_entry = PasswordReset(
        user_id=user_id, token_hash=hash_token(token), expires_at=expires_at
    )
    db.session.add(reset_entry)
    db.session.commit()
    return token


def verify_reset_token(token):
    result = db.session.execute(
        select(PasswordReset).where(
            PasswordReset.token_hash == hash_token(token),
            PasswordReset.expires_at > datetime.now(timezone.utc),
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
    db.session.execute(
        delete(PasswordReset).where(PasswordReset.token_hash == hash_token(token))
    )
    db.session.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    db.session.commit()
    return True


def validate_refresh_token(refresh_token):
    if not refresh_token:
        return None

    user = db.session.execute(
        select(User)
        .join(RefreshToken, User.id == RefreshToken.user_id)
        .where(
            RefreshToken.token_hash == hash_token(refresh_token),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    ).scalar_one_or_none()

    return _user_dict(user) if user else None


def delete_refresh_token(refresh_token):
    db.session.execute(
        delete(RefreshToken).where(
            RefreshToken.token_hash == hash_token(refresh_token)
        )
    )
    db.session.commit()


def is_demo_user(user_id):
    return bool(
        db.session.execute(
            select(User.is_demo).where(User.id == user_id)
        ).scalar_one_or_none()
    )


def create_session(user_id):
    token = secrets.token_urlsafe(64)
    ttl = DEMO_SESSION_TTL if is_demo_user(user_id) else SESSION_TTL
    expires_at = datetime.now(timezone.utc) + ttl

    session_entry = RefreshToken(
        user_id=user_id, token_hash=hash_token(token), expires_at=expires_at
    )
    db.session.add(session_entry)
    db.session.commit()
    return token


def rotate_refresh_token(old_token, user_id):
    delete_refresh_token(old_token)
    return create_session(user_id)
