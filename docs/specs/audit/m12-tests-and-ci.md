# M12: Tests and CI

> **Severity:** Medium · **Category:** Testing / delivery · **Effort:** Medium to Large (harness first; tests grow with each fix) · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** none. It is the **first implementation step**; every other spec adds its tests here.

## 1. Context and evidence

- No test files in the repo; no `.github/` or other CI configuration. `docs/specs/public-demo-mode.md` records that the tests added with the demo work were removed.
- `pytest` (9.1.1) is installed in the local `task-manager-backend/venv` but is not in `requirements.txt`.
- No frontend test runner in `task-manager-frontend/package.json`.
- `npm run lint` (`eslint .`) reports about 4,700 errors because `eslint.config.js` does not ignore generated output (`dist/`, `dev-dist/`). `eslint src` is clean and `tsc -p tsconfig.app.json --noEmit` is clean.
- `eslint.config.js` loads `typescript-eslint` and `eslint-plugin-react` only; `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` are installed but **not enabled**.
- Database features used (FULLTEXT `MATCH … AGAINST`, `timestampdiff`, a BEFORE UPDATE trigger) are MySQL-specific, so SQLite cannot stand in.

**Impact:** the riskiest logic (auth rotation, recurring completion and projection, per-user isolation) is untested and nothing blocks a broken merge.

## 2. Goals and non-goals

**Goals**
- One command runs backend and frontend checks locally; CI runs the same on every PR and push to `main`.
- Tests never touch a real database.
- Critical flows covered first.

**Non-goals**
- 100% coverage; browser end-to-end tests (can come later with Playwright); visual regression.

## 3. Design

### 3.1 Backend harness (`task-manager-backend/`)
- `requirements-dev.txt`: `pytest`, `pytest-cov`, `freezegun` (or `time-machine`), optional `fakeredis`.
- `pytest.ini`: `testpaths = tests`, `addopts = -q`.
- `tests/conftest.py`:
  - **Safety guard:** abort the whole session unless `DB_NAME` ends with `_test` and `DB_HOST` is local or the CI service host (rule inherited from the demo spec).
  - Creates the app via `create_app()` with test env; runs `init_db` against the test database once per session; truncates tables between tests (`SET FOREIGN_KEY_CHECKS=0` loop).
  - Fixtures: `app`, `client`, `make_user(email=…, is_demo=False)`, `login(client, user)` (returns cookies), `make_task(user, **fields)`, `frozen_time`.
  - Limiter uses `memory://` in tests; AI providers and MailerSend are always mocked (autouse fixture that fails if a real network call is attempted).

### 3.2 Priority backend tests
| Module | Covers |
|---|---|
| `test_auth.py` | register/login/me, cookie attributes, refresh rotation and grace ([H2](h2-refresh-race.md)), logout, reset revokes sessions ([M6](m6-token-hardening.md)), purge on login ([M5](m5-session-table-purge.md)), demo login unchanged |
| `test_isolation.py` | for every task, notification, subscription and stats route: user A cannot read/modify/delete user B's data |
| `test_recurring.py` | completion, skip, history rows, ghost projection ([M7](m7-recurring-completion.md)) |
| `test_validators.py` | task, list params ([M9](m9-list-endpoint-limits.md)), contact, AI inputs |
| `test_errors.py` | status codes and no leakage ([M2](m2-error-handling.md)) |
| `test_search.py` | [M10](m10-safe-search.md) |
| `test_rate_limits.py` | [H4](h4-redis-rate-limiting.md) |
| `test_ai_quota.py` | [H5](h5-ai-caps-and-quota.md), [M14](m14-ai-reliability.md) |
| `test_reminders.py` | [M8](m8-reminder-job.md) |
| `test_config.py` | [H3](h3-hardcoded-db-default.md), [M3](m3-engine-options.md), [M4](m4-db-tls.md) |

### 3.3 Frontend harness (`task-manager-frontend/`)
- Add `vitest`, `@vitest/coverage-v8`, `axios-mock-adapter`, `jsdom`; script `"test": "vitest run"`.
- First tests: `api.ts` interceptor ([H1](h1-logged-out-redirect.md), [H2](h2-refresh-race.md)), `utils/csv.ts` ([L8](l8-csv-formula-guard.md)), `toFormattedUTCDate`, `skipDate`, `useTasks` param building ([L6](l6-frontend-smells.md)).

### 3.4 Lint and typecheck configuration
- `eslint.config.js`: add `globalIgnores(["dist", "dev-dist", "coverage"])`.
- Enable `eslint-plugin-react-hooks` (`recommended`) and `eslint-plugin-react-refresh`; fix the findings (overlaps [L6](l6-frontend-smells.md)). If the number of findings is large, land the plugin at `warn` first, then raise to `error`.
- Add `"typecheck": "tsc -p tsconfig.app.json --noEmit"`.

### 3.5 CI: `.github/workflows/ci.yml`
Triggers: `pull_request`, `push` to `main`.
- **frontend** job: Node 20; `npm ci`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`.
- **backend** job: Python 3.11; services `mysql:8` (database `task_manager_test`, healthcheck) and `redis:7`; `pip install -r requirements.txt -r requirements-dev.txt`; env for test DB/Redis; `pytest --cov=app`.
- Cache pip and npm.
- Optional later: Docker build check ([M11](m11-deployment-hardening.md)), `pip-audit`/`npm audit` report-only job (dependency bumps are out of scope here).
- Branch protection is the owner's choice (recommend requiring both jobs).

## 4. Data and migration

Tests run `init_db.py` against the test database; they exercise the same migrations as production.

## 5. Security and failure behaviour

- No secrets in the workflow: use throwaway service-container credentials defined in the YAML.
- The guard in `conftest.py` is the main protection against running destructive truncation on a real database; it must fail closed.

## 6. Test plan

The harness itself: a smoke test that `GET /health` returns 200; the guard test that `DB_NAME=task_manager` aborts the session; CI green on a clean checkout.

## 7. Verification

Run locally (`docker compose up -d db redis` from [M11](m11-deployment-hardening.md) plus `pytest`) and in a draft PR; deliberately break one test to confirm the pipeline fails.

## 8. Dependencies

- Everything else adds tests here. [M11](m11-deployment-hardening.md) supplies the local MySQL/Redis compose services.

## 9. Open questions and user-only actions

- **You:** enable branch protection after the first green run.
- Decide whether to add Playwright smoke tests later.
