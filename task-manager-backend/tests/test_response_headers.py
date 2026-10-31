from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture
def built_frontend(app: Flask, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log('x');\n" * 400)
    (tmp_path / "index.html").write_text("<html>spa</html>")
    monkeypatch.setattr(app, "static_folder", str(tmp_path))


def test_every_response_carries_security_headers(client: FlaskClient) -> None:
    headers = client.get("/health").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in headers["Content-Security-Policy-Report-Only"]


def test_api_responses_are_never_cached(client: FlaskClient) -> None:
    assert client.get("/api/does-not-exist").headers["Cache-Control"] == "no-store"


def test_hashed_assets_are_cached_forever_and_compressed(
    client: FlaskClient, built_frontend: None
) -> None:
    response = client.get(
        "/assets/app-abc123.js", headers={"Accept-Encoding": "gzip, deflate, br"}
    )
    assert "immutable" in response.headers["Cache-Control"]
    assert response.headers["Content-Encoding"] in ("br", "gzip", "zstd")


def test_the_html_entry_point_is_revalidated(
    client: FlaskClient, built_frontend: None
) -> None:
    assert client.get("/some/page").headers["Cache-Control"] == "no-cache"


def test_hsts_is_sent_over_https_only(client: FlaskClient) -> None:
    assert "Strict-Transport-Security" not in client.get("/health").headers
    secure = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert "max-age=31536000" in secure.headers["Strict-Transport-Security"]
