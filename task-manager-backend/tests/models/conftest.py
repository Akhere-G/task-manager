from collections.abc import Callable, Iterator

import pytest
from flask import Flask

from app.database import db


@pytest.fixture
def app_context(app: Flask) -> Iterator[None]:
    with app.app_context():
        yield
        db.session.rollback()


@pytest.fixture
def user_id(make_user: Callable[..., int], app_context: None) -> int:
    return make_user()
