# H3: Remove the hardcoded DB password fallback; fail fast on missing config

> **Severity:** High (as audited) · **Category:** Security / configuration · **Effort:** Small · **Status:** Specified, not implemented
> **Decision recorded:** the password in source was **not a real secret**. No credential rotation and no git-history rewrite.
> **Depends on:** none. Provides the config layer used by [M3](m3-engine-options.md), [M4](m4-db-tls.md), [H4](h4-redis-rate-limiting.md).

## 1. Context and evidence

- `task-manager-backend/app/main.py:29`: `os.getenv("DB_PASSWORD", "<hardcoded value>")`. Introduced in commit `95e2d64` and present in history.
- `main.py:41`: `JWT_SECRET_KEY` is read without validation. A missing value only fails when the first token is created.
- `app/database.py:12-18` repeats the DB settings with *different* defaults (`root` / empty password / `127.0.0.1`), so the two code paths can point at different databases.
- `app/routes/auth_routes.py:238` (reset link) uses `FRONTEND_URL` without checking it exists.

**Impact:** a deployment that forgets `DB_PASSWORD` silently uses a default instead of failing; inconsistent defaults between the web app and scripts; auth failures surface late.

## 2. Goals and non-goals

**Goals**
- The app refuses to start with a clear message when required configuration is missing.
- One place builds the database URL.

**Non-goals**
- Rotating credentials or rewriting history (the value was not real).
- Secret-manager integration.

## 3. Design

New `task-manager-backend/app/config.py`:

```python
REQUIRED = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET_KEY", "FRONTEND_URL"]

def require_env(names=REQUIRED) -> dict: ...   # raises RuntimeError listing every missing name
def build_database_url() -> str: ...           # single source for main.py, database.py, init_db.py
```

- `DB_PORT` keeps a default of `3306` (not a secret).
- `create_app()` calls `require_env()` first; `JWT_SECRET_KEY` must be non-empty (and at least 32 characters; log a warning below that rather than fail, so existing short dev keys still boot).
- `main.py`: delete the hardcoded default and the other implicit defaults (`DB_USER=root`, `DB_HOST=localhost`).
- `database.py`: use `build_database_url()`. (The throwaway Flask app is removed in [M3](m3-engine-options.md).)
- `init_db.py` and `run_reminders.py` use the same helper.
- `.env.example`: list every required variable with a comment.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Startup failure message names variables only, never values.
- Tests and CI must set the variables (CI uses the MySQL service container credentials).

## 6. Test plan

- `create_app()` raises `RuntimeError` naming each missing variable when env is empty.
- `create_app()` succeeds with all required variables set.
- `build_database_url()` URL-encodes special characters in the password.

## 7. Verification

- Start the app with `DB_PASSWORD` unset: expect an immediate, readable failure.
- `grep -rn` for the old default string returns nothing in the working tree (history is deliberately left alone).

## 8. Dependencies

- Used by [M3](m3-engine-options.md), [M4](m4-db-tls.md), [M11](m11-deployment-hardening.md) (compose/Dockerfile pass these variables).

## 9. Open questions and user-only actions

- Make sure Cloud Run has every required variable (especially `FRONTEND_URL`) **before** deploying this change, otherwise the new fail-fast will stop the revision from starting.
