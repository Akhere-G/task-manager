import secrets
from datetime import timedelta

from sqlalchemy import select

from app.constants import API_TOKEN_PREFIX_LENGTH
from app.database import db
from app.exceptions import ApiTokenNotFound, InvalidApiToken
from app.models import ApiToken, TokenScope
from app.services.auth_service import hash_token
from app.utils.dates import utc_now

TOKEN_PREFIX = "tm_"
LAST_USED_RESOLUTION = timedelta(minutes=1)


def list_api_tokens(user_id: int) -> list[ApiToken]:
    stmt = (
        select(ApiToken)
        .where(ApiToken.user_id == user_id)
        .order_by(ApiToken.created_at.desc(), ApiToken.id.desc())
    )
    return list(db.session.scalars(stmt))


def create_api_token(
    user_id: int, name: str, scope: TokenScope
) -> tuple[ApiToken, str]:
    plaintext = f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
    token = ApiToken(
        user_id=user_id,
        name=name,
        scope=scope,
        token_hash=hash_token(plaintext),
        prefix=plaintext[:API_TOKEN_PREFIX_LENGTH],
    )
    db.session.add(token)
    db.session.commit()
    return token, plaintext


def delete_api_token(user_id: int, token_id: int) -> None:
    token = db.session.scalar(
        select(ApiToken).where(ApiToken.user_id == user_id, ApiToken.id == token_id)
    )
    if token is None:
        raise ApiTokenNotFound()
    db.session.delete(token)
    db.session.commit()


def resolve_api_token(plaintext: str) -> ApiToken:
    token = db.session.scalar(
        select(ApiToken).where(ApiToken.token_hash == hash_token(plaintext))
    )
    if token is None:
        raise InvalidApiToken()
    _record_use(token)
    return token


def _record_use(token: ApiToken) -> None:
    now = utc_now()
    if token.last_used_at is None or now - token.last_used_at >= LAST_USED_RESOLUTION:
        token.last_used_at = now
        db.session.commit()
