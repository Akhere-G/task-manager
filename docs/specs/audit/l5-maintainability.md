# L5: Maintainability (serializer, requirements, migrations, schema drift)

> **Severity:** Low · **Category:** Maintainability · **Effort:** Medium · **Status:** Specified, not implemented
> **Finding status:** Confirmed. Dependency **version bumps** are out of scope (M1); this spec only **removes unused packages**.
> **Depends on:** [M12](m12-tests-and-ci.md) (safety net), [M7](m7-recurring-completion.md) and [M13](m13-stats-performance.md) (touch the same code, land first).

## 1. Context and evidence

**Duplication**
- The task-to-dict mapping is copied five times: `app/services/task_service.py:59-75,114-129,193-206,232-245` and `app/services/stats_service.py:292-310`.

**Schema in three places that already disagree**
- `init_db.py` (what actually creates tables), `schema.sql` (stale) and the SQLAlchemy models.
- Models: `User.first_name` `String(100)`, `email` `String(255)`; `init_db.py`: `VARCHAR(50)`/`VARCHAR(100)`.
- `PasswordReset` model has `user_id` as primary key; the real table has `id` as primary key.
- Notification models omit `ondelete="CASCADE"` that the real tables have.
- `schema.sql:26` uses `CREATE FULLTEXT INDEX IF NOT EXISTS`, which MySQL does not support.
- `init_db.py:57` runs `CREATE DATABASE IF NOT EXISTS` after already connecting to that database (dead code); `ca_path` is computed and unused (see [M4](m4-db-tls.md)); `f"CREATE DATABASE {db_name}"` interpolates an env value into SQL.
- No migration tool: schema changes are hand-written idempotent steps.

**Unused dependencies** (no imports found in `app/` or `init_db.py`): `openai`, `genai` (a different PyPI package from `google-genai`, which is what the code imports), `tiktoken`, `aiohttp` (+ its helper packages), `beautifulsoup4`/`soupsieve`, and the interactive-shell stack (`ipython`, `jedi`, `parso`, `pexpect`, `ptyprocess`, `prompt_toolkit`, `wcwidth`, `asttokens`, `executing`, `pure_eval`, `stack-data`, `decorator`, `traitlets`, `matplotlib-inline`, `Pygments`), plus `tabulate`. `requirements.txt` is a full `pip freeze` (86 lines) rather than direct dependencies.

## 2. Goals and non-goals

**Goals**
- One serializer; one source of truth for the schema; lean, accurate requirements.

**Non-goals**
- Version upgrades (M1); changing the data model; ORM rewrite.

## 3. Design

### 3.1 Serializer
`app/utils/serializers.py::task_to_dict(task, fields=TASK_FIELDS)`; `TASK_FIELDS` is the full list used by the list/get endpoints; update paths pass a subset. Replace the five copies. Pure refactor, covered by existing and new tests.

### 3.2 Requirements
- `requirements.txt`: direct runtime dependencies only (Flask, Flask-Cors, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Limiter, redis, gunicorn, PyMySQL, SQLAlchemy, marshmallow, marshmallow-sqlalchemy, python-dotenv, python-dateutil, mailersend, pywebpush, google-genai, groq, plus anything the tests confirm is needed). Pin the **currently resolved** versions of those so behaviour does not change.
- `requirements-dev.txt` (from [M12](m12-tests-and-ci.md)): pytest etc.
- Procedure: build a fresh venv from the new file, `pip check`, run the full test suite, boot the app, run `init_db.py`, run the reminder job against the test DB.
- Confirm `mysql-connector-python` is unused (the code uses PyMySQL) before dropping it.

### 3.3 Alembic (last in this spec)
- Add `alembic`; `migrations/` folder; `env.py` uses `build_database_url()` ([H3](h3-hardcoded-db-default.md)) and the same SSL settings ([M4](m4-db-tls.md)).
- **Baseline revision** = the production schema *including* the changes from earlier phases (token hashes, `replaced_at`, `reminded_for_start_at`, indexes), the FULLTEXT index and the completion trigger via `op.execute`. Generate with `alembic revision --autogenerate` against a database built by `init_db.py`, then hand-fix (autogenerate does not see triggers or FULLTEXT).
- Existing databases: `alembic stamp <baseline>`. Fresh databases: `alembic upgrade head`.
- `init_db.py` becomes a thin wrapper around `alembic upgrade head` (keeps the strict exit-code behaviour from [M11](m11-deployment-hardening.md)); `start.sh` unchanged.
- Delete `schema.sql` or regenerate it with `alembic upgrade head --sql` and mark it generated.

### 3.4 Model/DB alignment
Inspect the production column definitions first (read-only `SHOW CREATE TABLE`), then make the models match reality (lengths 50/100 or widen the DB in a migration, decision recorded in the baseline), set the `PasswordReset` primary key correctly, add `ondelete="CASCADE"` to notification FKs.

### 3.5 init_db cleanup
Remove the dead `CREATE DATABASE`/`USE`; no f-string SQL with env values.

## 4. Data and migration

Alembic stamping on production is a one-off; rehearse on a copy of the database.

## 5. Security and failure behaviour

- Migrations run from the deploy step with the same credentials as the app; avoid granting extra privileges.
- Trigger creation needs the TRIGGER privilege; keep it as a warning-level step if unavailable ([M11](m11-deployment-hardening.md)).

## 6. Test plan

- Serializer: golden dict equality with the old output for a sample task.
- Fresh DB via Alembic equals fresh DB via the old `init_db.py` (compare `information_schema`).
- Stamped existing DB: `alembic upgrade head` is a no-op.
- Clean-venv install and full test run after the requirements trim.

## 7. Verification

`pip check` clean; image build size shrinks ([M11](m11-deployment-hardening.md)); app boots; `alembic current` shows head in staging and production.

## 8. Dependencies

- [M12](m12-tests-and-ci.md), [M7](m7-recurring-completion.md), [M13](m13-stats-performance.md), [M11](m11-deployment-hardening.md), [M4](m4-db-tls.md).

## 9. Open questions and user-only actions

- **You:** allow a read-only `SHOW CREATE TABLE` against production (or provide the output) for step 3.4, and agree on a rehearsal on a DB copy.
