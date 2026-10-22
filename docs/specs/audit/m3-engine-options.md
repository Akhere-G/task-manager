# M3: Apply SQLAlchemy pool options to the real app

> **Severity:** Medium · **Category:** Reliability · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** [H3](h3-hardcoded-db-default.md) (shared URL builder). Pairs with [M4](m4-db-tls.md) (same `connect_args`).

## 1. Context and evidence

- `task-manager-backend/app/database.py:15-26` creates a **second** `Flask(__name__)` and sets `SQLALCHEMY_ENGINE_OPTIONS` (`pool_size=10`, `pool_recycle=280`, `pool_pre_ping=True`) on it. That app is never used to serve requests.
- `app/main.py:create_app` sets only `SQLALCHEMY_DATABASE_URI` and `SQLALCHEMY_TRACK_MODIFICATIONS`. Flask-SQLAlchemy therefore uses its default `pool_recycle=7200` (confirmed in the installed `flask_sqlalchemy/extension.py:640`) and **no pre-ping**.
- The standalone `engine` in `database.py:34` (used by `run_reminders.py` and the demo seed) does have the options.
- `/api/keep-alive` exists in `main.py` and looks like a workaround for idle-connection drops.

**Impact:** with a remote managed MySQL that closes idle connections, the first request after idle can fail with "MySQL server has gone away".

## 2. Goals and non-goals

**Goals**
- Web app and standalone scripts share one engine configuration with pre-ping and recycle.

**Non-goals**
- Changing pool sizing for load (revisit after [M13](m13-stats-performance.md) measurements).
- Removing `/api/keep-alive` (harmless; may be used by an uptime pinger).

## 3. Design

In `app/database.py`:

```python
ENGINE_OPTIONS = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
    "pool_size": 10,
    "max_overflow": 5,
    "connect_args": build_connect_args(),   # timeouts (+ ssl from M4)
}
```

- `connect_args`: `connect_timeout=10`, `read_timeout=30`, `write_timeout=30` (seconds). SSL arguments are added by [M4](m4-db-tls.md).
- Delete the throwaway Flask app and its config lines. Keep `db = SQLAlchemy(model_class=Base)`.
- `create_app()`: `app.config["SQLALCHEMY_ENGINE_OPTIONS"] = ENGINE_OPTIONS` before `db.init_app(app)`.
- `engine = create_engine(DATABASE_URL, **ENGINE_OPTIONS)`; `SessionLocal` unchanged.
- Gunicorn sizing ([M11](m11-deployment-hardening.md)): `workers × (pool_size + max_overflow)` must stay below the DB's connection limit. Document the arithmetic in the README (default 2 workers × 15 = 30).

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Pre-ping adds one cheap round trip per checkout; acceptable.
- Timeouts convert hangs into errors that the catch-all handler ([M2](m2-error-handling.md)) turns into a 500 without leaking details.

## 6. Test plan

- `app.extensions["sqlalchemy"].engine.pool._pre_ping` is true (assert on `db.engine.pool` attributes) and `pool._recycle == 280`.
- Standalone `engine` has the same options.
- Import of `app.database` no longer creates a Flask app (`hasattr(module, "app")` is false).

## 7. Verification

Local: set MySQL `wait_timeout=5`, load a page, wait 10 s, load again: no "gone away" error.

## 8. Dependencies

- [H3](h3-hardcoded-db-default.md), [M4](m4-db-tls.md), [M11](m11-deployment-hardening.md).

## 9. Open questions and user-only actions

- Confirm the managed DB's idle timeout (the original 280 s suggests 300 s); adjust `pool_recycle` below it.
