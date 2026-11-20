import pytest

from app.config import build_database_url


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_database_url_preserves_credentials_and_neon_options(
    monkeypatch: pytest.MonkeyPatch, scheme: str
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        f"{scheme}://owner:p%40ss%2Fword@db.example.com:5432/task_manager"
        "?sslmode=require&channel_binding=require",
    )

    url = build_database_url()

    assert url.drivername == "postgresql+psycopg"
    assert url.username == "owner"
    assert url.password == "p@ss/word"
    assert (url.host, url.port, url.database) == (
        "db.example.com",
        5432,
        "task_manager",
    )
    assert dict(url.query) == {"sslmode": "require", "channel_binding": "require"}


def test_database_url_allows_local_passwordless_connections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres@localhost/task_manager")

    url = build_database_url()

    assert url.password is None
    assert url.database == "task_manager"


@pytest.mark.parametrize("value", [None, ""])
def test_database_url_is_required(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    if value is None:
        monkeypatch.delenv("DATABASE_URL")
    else:
        monkeypatch.setenv("DATABASE_URL", value)

    with pytest.raises(RuntimeError, match="Missing required.*DATABASE_URL"):
        build_database_url()
