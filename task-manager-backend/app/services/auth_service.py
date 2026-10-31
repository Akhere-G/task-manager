import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.database import db
from app.demo import DEMO_USER_EMAIL
from app.exceptions import EmailTaken
from app.models import PasswordReset, RefreshToken, User

SESSION_TTL = timedelta(days=7)
DEMO_SESSION_TTL = timedelta(hours=24)
REFRESH_GRACE = timedelta(seconds=10)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_user(first_name: str, last_name: str, email: str, password: str) -> User:
    new_user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=generate_password_hash(password),
    )

    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise EmailTaken() from None
    return new_user


_DUMMY_PASSWORD_HASH = generate_password_hash("not-a-real-password")


def login_user(email: str, password: str) -> User | None:
    user = db.session.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if not user or user.is_demo:
        check_password_hash(_DUMMY_PASSWORD_HASH, password)
        return None

    return user if check_password_hash(user.password_hash, password) else None


def get_demo_user() -> User | None:
    return db.session.execute(
        select(User).where(User.is_demo.is_(True), User.email == DEMO_USER_EMAIL)
    ).scalar_one_or_none()


def get_user(id: int | None = None, email: str | None = None) -> User | None:
    if not id and not email:
        return None

    stmt = select(User)
    if id:
        stmt = stmt.where(User.id == id)
    else:
        stmt = stmt.where(User.email == email)

    return db.session.execute(stmt).scalar_one_or_none()


def create_reset_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(minutes=15)

    db.session.execute(delete(PasswordReset).where(PasswordReset.user_id == user_id))

    reset_entry = PasswordReset(
        user_id=user_id, token_hash=hash_token(token), expires_at=expires_at
    )
    db.session.add(reset_entry)
    db.session.commit()
    return token


def verify_reset_token(token: str) -> int | None:
    result = db.session.execute(
        select(PasswordReset).where(
            PasswordReset.token_hash == hash_token(token),
            PasswordReset.expires_at > datetime.now(UTC),
        )
    ).scalar_one_or_none()

    return result.user_id if result else None


def update_password_and_clear_token(
    user_id: int, token: str, new_password: str
) -> bool:
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


def validate_refresh_token(refresh_token: str | None) -> User | None:
    if not refresh_token:
        return None

    now = datetime.now(UTC)
    return db.session.execute(
        select(User)
        .join(RefreshToken, User.id == RefreshToken.user_id)
        .where(
            RefreshToken.token_hash == hash_token(refresh_token),
            RefreshToken.expires_at > now,
            or_(
                RefreshToken.replaced_at.is_(None),
                RefreshToken.replaced_at > now - REFRESH_GRACE,
            ),
        )
    ).scalar_one_or_none()


def delete_refresh_token(refresh_token: str) -> None:
    db.session.execute(
        delete(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    db.session.commit()


PURGE_BATCH_SIZE = 500


def purge_expired_sessions(user_id: int) -> None:
    now = datetime.now(UTC)
    cutoff = now - REFRESH_GRACE
    db.session.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == user_id,
            or_(RefreshToken.expires_at < now, RefreshToken.replaced_at < cutoff),
        )
    )
    db.session.execute(
        text(
            "DELETE FROM refresh_tokens WHERE expires_at < :now "
            f"OR replaced_at < :cutoff LIMIT {PURGE_BATCH_SIZE}"
        ),
        {"now": now, "cutoff": cutoff},
    )
    db.session.execute(
        text(
            f"DELETE FROM password_resets WHERE expires_at < :now LIMIT {PURGE_BATCH_SIZE}"
        ),
        {"now": now},
    )
    db.session.commit()


def is_demo_user(user_id: int | None) -> bool:
    return bool(
        db.session.execute(
            select(User.is_demo).where(User.id == user_id)
        ).scalar_one_or_none()
    )


def _add_session(user_id: int) -> str:
    token = secrets.token_urlsafe(64)
    ttl = DEMO_SESSION_TTL if is_demo_user(user_id) else SESSION_TTL
    expires_at = datetime.now(UTC) + ttl

    session_entry = RefreshToken(
        user_id=user_id, token_hash=hash_token(token), expires_at=expires_at
    )
    db.session.add(session_entry)
    return token


def create_session(user_id: int) -> str:
    token = _add_session(user_id)
    db.session.commit()
    return token


def rotate_refresh_token(old_token: str, user_id: int) -> str | None:
    claimed = db.session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_token(old_token),
            RefreshToken.replaced_at.is_(None),
        )
        .values(replaced_at=datetime.now(UTC))
    )
    if claimed.rowcount != 1:
        db.session.rollback()
        return None

    token = _add_session(user_id)
    db.session.commit()
    return token
