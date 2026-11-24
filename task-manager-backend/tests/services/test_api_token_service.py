from datetime import timedelta

import pytest
from sqlalchemy import select

from app.database import db
from app.models import ApiToken, TokenScope
from app.services.api_token_service import (
    create_api_token,
    resolve_api_token,
)
from app.utils.dates import utc_now

pytestmark = pytest.mark.integration


def test_a_created_token_resolves_and_only_its_hash_is_stored(user_id: int) -> None:
    token, plaintext = create_api_token(user_id, "laptop", TokenScope.READ)

    assert plaintext.startswith("tm_")
    assert token.prefix == plaintext[: len(token.prefix)]
    assert plaintext not in {token.token_hash, token.name, token.prefix}
    assert resolve_api_token(plaintext).id == token.id


def test_using_a_token_stamps_last_used_at_at_most_once_a_minute(
    user_id: int,
) -> None:
    token, plaintext = create_api_token(user_id, "laptop", TokenScope.READ)
    assert token.last_used_at is None

    resolve_api_token(plaintext)
    first_use = token.last_used_at
    resolve_api_token(plaintext)
    assert first_use is not None
    assert token.last_used_at == first_use

    token.last_used_at = utc_now() - timedelta(minutes=2)
    db.session.commit()
    resolve_api_token(plaintext)
    stored = db.session.scalar(select(ApiToken).where(ApiToken.id == token.id))
    assert utc_now() - stored.last_used_at < timedelta(minutes=1)
