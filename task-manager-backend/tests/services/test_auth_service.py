from datetime import datetime, timedelta, timezone

import pytest

from app.database import db
from app.models import PasswordReset, RefreshToken, User
from app.services import auth_service
from app.services.auth_service import hash_token
from tests.conftest import DEFAULT_PASSWORD


@pytest.fixture
def ctx(app):
    with app.app_context():
        yield


def naive_utc(delta=timedelta()):
    return datetime.now(timezone.utc).replace(tzinfo=None) + delta


@pytest.fixture
def user_id(ctx, make_user):
    return make_user()


def test_new_users_can_log_in_and_duplicates_are_refused(ctx):
    user_id = auth_service.create_user("Ann", "Lee", "ann@example.com", DEFAULT_PASSWORD)
    assert auth_service.login_user("ann@example.com", DEFAULT_PASSWORD)["id"] == user_id
    assert auth_service.login_user("ann@example.com", "wrong-pass1") is None
    assert auth_service.create_user("Ann", "Lee", "ann@example.com", DEFAULT_PASSWORD) == "EXISTS"


def test_demo_users_cannot_log_in_with_a_password(ctx, make_demo_user):
    make_demo_user()
    assert auth_service.login_user("demo@taskflow.invalid", DEFAULT_PASSWORD) is None


def test_session_tokens_are_stored_hashed(user_id):
    token = auth_service.create_session(user_id)
    row = db.session.query(RefreshToken).one()
    assert row.token_hash == hash_token(token)
    assert row.token is None
    assert auth_service.validate_refresh_token(token)["id"] == user_id


def test_expired_sessions_are_invalid(user_id):
    token = auth_service.create_session(user_id)
    db.session.query(RefreshToken).update({"expires_at": naive_utc(timedelta(seconds=-1))})
    db.session.commit()
    assert auth_service.validate_refresh_token(token) is None


def test_rotating_gives_a_new_token_and_the_old_one_works_only_briefly(user_id):
    old = auth_service.create_session(user_id)
    new = auth_service.rotate_refresh_token(old, user_id)

    assert new and new != old
    assert auth_service.validate_refresh_token(old)
    assert auth_service.validate_refresh_token(new)

    db.session.query(RefreshToken).filter_by(token_hash=hash_token(old)).update(
        {"replaced_at": naive_utc(timedelta(seconds=-30))}
    )
    db.session.commit()
    assert auth_service.validate_refresh_token(old) is None


def test_a_token_can_only_be_rotated_once(user_id):
    old = auth_service.create_session(user_id)
    assert auth_service.rotate_refresh_token(old, user_id)
    assert auth_service.rotate_refresh_token(old, user_id) is None


def test_purging_removes_expired_and_replaced_sessions_but_keeps_live_ones(user_id):
    live = auth_service.create_session(user_id)
    expired = auth_service.create_session(user_id)
    replaced = auth_service.create_session(user_id)
    db.session.query(RefreshToken).filter_by(token_hash=hash_token(expired)).update(
        {"expires_at": naive_utc(timedelta(days=-1))}
    )
    db.session.query(RefreshToken).filter_by(token_hash=hash_token(replaced)).update(
        {"replaced_at": naive_utc(timedelta(minutes=-5))}
    )
    db.session.commit()

    auth_service.purge_expired_sessions(user_id)

    remaining = {row.token_hash for row in db.session.query(RefreshToken)}
    assert remaining == {hash_token(live)}


def test_reset_tokens_are_single_use_and_expire(user_id):
    token = auth_service.create_reset_token(user_id)
    assert auth_service.verify_reset_token(token) == user_id

    assert auth_service.update_password_and_clear_token(user_id, token, "Another-pass7")
    assert auth_service.verify_reset_token(token) is None

    fresh = auth_service.create_reset_token(user_id)
    db.session.query(PasswordReset).update({"expires_at": naive_utc(timedelta(minutes=-1))})
    db.session.commit()
    assert auth_service.verify_reset_token(fresh) is None


def test_resetting_the_password_revokes_every_session(user_id):
    auth_service.create_session(user_id)
    token = auth_service.create_reset_token(user_id)

    auth_service.update_password_and_clear_token(user_id, token, "Another-pass7")

    assert db.session.query(RefreshToken).count() == 0
    assert auth_service.login_user("user@example.com", "Another-pass7")


def test_demo_sessions_are_shorter_than_normal_ones(ctx, make_user, make_demo_user):
    normal = make_user("a@example.com")
    demo = make_demo_user()
    auth_service.create_session(normal)
    auth_service.create_session(demo)

    ttl = {
        row.user_id: row.expires_at - naive_utc()
        for row in db.session.query(RefreshToken)
    }
    assert ttl[demo] < timedelta(hours=25) < timedelta(days=6) < ttl[normal]


def test_deleting_a_user_removes_their_tokens(user_id):
    auth_service.create_session(user_id)
    auth_service.create_reset_token(user_id)

    db.session.delete(db.session.get(User, user_id))
    db.session.commit()

    assert db.session.query(RefreshToken).count() == 0
    assert db.session.query(PasswordReset).count() == 0
