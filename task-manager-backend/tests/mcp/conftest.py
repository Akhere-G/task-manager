from collections.abc import Callable

import pytest
from flask.testing import FlaskClient


@pytest.fixture
def make_token(session: FlaskClient) -> Callable[..., str]:
    def _make_token(scope: str = "write", name: str = "test") -> str:
        response = session.post("/api/api-tokens", json={"name": name, "scope": scope})
        assert response.status_code == 201, response.get_json()
        return response.get_json()["token"]

    return _make_token
