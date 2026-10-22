import app.database as database


def test_web_app_engine_uses_pool_options(app):
    with app.app_context():
        pool = database.db.engine.pool
    assert pool._pre_ping is True
    assert pool._recycle == 280
    assert pool.size() == 10
    assert pool._max_overflow == 5


def test_standalone_engine_uses_same_options():
    pool = database.engine.pool
    assert pool._pre_ping is True
    assert pool._recycle == 280


def test_connection_timeouts_are_set():
    args = database.ENGINE_OPTIONS["connect_args"]
    assert args["connect_timeout"] == 10
    assert args["read_timeout"] == 30
    assert args["write_timeout"] == 30


def test_database_module_no_longer_creates_a_second_flask_app():
    assert not hasattr(database, "app")
