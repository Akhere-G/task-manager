import pytest

from app.config import APP_REQUIRED, DB_REQUIRED, build_database_url, require_env
from app.main import create_app

ALL_REQUIRED = DB_REQUIRED + APP_REQUIRED


@pytest.mark.parametrize("name", ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET_KEY", "FRONTEND_URL"])
def test_app_refuses_to_start_without_required_variable(monkeypatch, name):
    monkeypatch.delenv(name)
    with pytest.raises(RuntimeError) as error:
        create_app()
    assert name in str(error.value)


def test_missing_password_variable_is_reported(monkeypatch):
    monkeypatch.delenv("DB_PASSWORD")
    with pytest.raises(RuntimeError, match="DB_PASSWORD"):
        require_env(DB_REQUIRED)


def test_empty_database_password_is_allowed(monkeypatch):
    monkeypatch.setenv("DB_PASSWORD", "")
    require_env(DB_REQUIRED)


def test_empty_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "")
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        require_env(APP_REQUIRED)


def test_error_lists_every_missing_name_without_values(monkeypatch):
    monkeypatch.delenv("DB_HOST")
    monkeypatch.delenv("FRONTEND_URL")
    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret-value")
    with pytest.raises(RuntimeError) as error:
        require_env(ALL_REQUIRED)
    message = str(error.value)
    assert "DB_HOST" in message and "FRONTEND_URL" in message
    assert "super-secret-value" not in message


def test_database_url_escapes_special_characters(monkeypatch):
    monkeypatch.setenv("DB_PASSWORD", "p@ss/w:rd#1")
    url = build_database_url()
    assert url.password == "p@ss/w:rd#1"
    assert "p@ss/w:rd#1" not in url.render_as_string(hide_password=True)
    assert url.drivername == "mysql+pymysql"


def test_no_hardcoded_database_password_fallback():
    import inspect
    import app.main as main

    assert "getenv(\"DB_PASSWORD\"," not in inspect.getsource(main)


def test_ssl_ca_unset_means_no_ssl(monkeypatch):
    from app.config import ssl_ca_path
    from app.database import build_connect_args

    monkeypatch.delenv("DB_SSL_CA", raising=False)
    assert ssl_ca_path() is None
    assert "ssl" not in build_connect_args()


def test_ssl_ca_is_added_to_connection_arguments(monkeypatch, tmp_path):
    from app.database import build_connect_args

    ca = tmp_path / "ca.pem"
    ca.write_text("not a real certificate")
    monkeypatch.setenv("DB_SSL_CA", str(ca))
    assert build_connect_args()["ssl"] == {"ca": str(ca)}


def test_relative_ssl_ca_resolves_from_project_root(monkeypatch):
    from app.config import ssl_ca_path

    monkeypatch.setenv("DB_SSL_CA", "ca.pem")
    assert ssl_ca_path().endswith("task-manager-backend/ca.pem")


def test_missing_ssl_ca_file_fails_loudly(monkeypatch):
    from app.config import ssl_ca_path

    monkeypatch.setenv("DB_SSL_CA", "/does/not/exist.pem")
    with pytest.raises(RuntimeError, match="DB_SSL_CA"):
        ssl_ca_path()
