from collections.abc import Callable
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.database import db
from app.exceptions import ApiTokenNotFound, InvalidApiToken
from app.models import ApiToken, TokenScope
from app.services.api_token_service import (
    create_api_token,
    delete_api_token,
    list_api_tokens,
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


def test_an_unknown_token_is_rejected(user_id: int) -> None:
    create_api_token(user_id, "laptop", TokenScope.READ)

    with pytest.raises(InvalidApiToken):
        resolve_api_token("tm_not-a-real-token")


def test_a_revoked_token_no_longer_resolves(user_id: int) -> None:
    token, plaintext = create_api_token(user_id, "laptop", TokenScope.WRITE)

    delete_api_token(user_id, token.id)

    with pytest.raises(InvalidApiToken):
        resolve_api_token(plaintext)


def test_a_token_cannot_be_revoked_by_another_user(
    user_id: int, make_user: Callable[..., int]
) -> None:
    other_id = make_user("other@example.com")
    token, _ = create_api_token(user_id, "laptop", TokenScope.READ)

    with pytest.raises(ApiTokenNotFound):
        delete_api_token(other_id, token.id)

    assert [t.id for t in list_api_tokens(user_id)] == [token.id]
    assert list_api_tokens(other_id) == []


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


def test_write_scope_allows_both_and_read_scope_only_reads() -> None:
    assert TokenScope.WRITE.allows(TokenScope.READ)
    assert TokenScope.WRITE.allows(TokenScope.WRITE)
    assert TokenScope.READ.allows(TokenScope.READ)
    assert not TokenScope.READ.allows(TokenScope.WRITE)
