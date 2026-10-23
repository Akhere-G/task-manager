import pytest


@pytest.fixture(autouse=True)
def fresh_state(clean_tables, reset_rate_limits):
    yield
