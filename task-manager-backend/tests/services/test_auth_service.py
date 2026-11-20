from collections.abc import Callable
from datetime import timedelta

import pytest
from flask import Flask
from sqlalchemy import func, select

from app.database import db
from app.exceptions import EmailTaken
from app.models import PasswordReset, RefreshToken
from app.services.auth_service import (
    PURGE_BATCH_SIZE,
    create_user,
    get_user,
    login_user,
    purge_expired_sessions,
)
from app.utils.dates import utc_now


def test_email_lookup_and_uniqueness_ignore_case(app: Flask) -> None:
    with app.app_context():
        user = create_user("Ann", "Test", "Ann@example.com", "Sturdy-pass9")

        assert login_user("ANN@EXAMPLE.COM", "Sturdy-pass9") is user
        assert get_user(email="ann@example.com") is user
        with pytest.raises(EmailTaken):
            create_user("Ann", "Duplicate", "ann@example.com", "Sturdy-pass9")


def test_cleanup_deletes_expired_sessions_in_bounded_batches(
    app: Flask, make_user: Callable[..., int]
) -> None:
    owner = make_user("owner@example.com")
    other = make_user("other@example.com")
    now = utc_now()
    expired, future = now - timedelta(days=1), now + timedelta(days=1)

    with app.app_context():
        db.session.add_all(
            RefreshToken(user_id=owner, expires_at=expired)
            for _ in range(PURGE_BATCH_SIZE + 2)
        )
        db.session.add_all(
            RefreshToken(user_id=other, expires_at=expired)
            for _ in range(PURGE_BATCH_SIZE + 2)
        )
        db.session.add_all(
            PasswordReset(user_id=other, expires_at=expired)
            for _ in range(PURGE_BATCH_SIZE + 2)
        )
        live_token = RefreshToken(user_id=other, expires_at=future)
        live_reset = PasswordReset(user_id=other, expires_at=future)
        db.session.add_all(
            [
                live_token,
                live_reset,
                RefreshToken(user_id=owner, expires_at=future, replaced_at=expired),
            ]
        )
        db.session.commit()

        purge_expired_sessions(owner)

        assert (
            db.session.scalar(
                select(func.count())
                .select_from(RefreshToken)
                .where(RefreshToken.user_id == owner)
            )
            == 0
        )
        assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 3
        assert db.session.scalar(select(func.count()).select_from(PasswordReset)) == 3
        assert db.session.get(RefreshToken, live_token.id) is live_token
        assert db.session.get(PasswordReset, live_reset.id) is live_reset
