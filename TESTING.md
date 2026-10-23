# Testing

Three layers, each with one command. Run them from the folder shown.

| Layer | What it covers | Command | Needs |
| --- | --- | --- | --- |
| Backend unit | Pure logic: recurrence dates, repeat rules, schemas, AI output parsing | `python -m pytest tests/unit` | nothing |
| Backend integration | Services and Flask routes against a real MySQL: ghost-task projection, completing recurring tasks, auth cookies, user isolation, stats, AI routes with the provider mocked | `python -m pytest` | MySQL |
| Frontend unit and integration | Date helpers, validators, task mutations with TanStack Query (invalidation, refetch, failures), forms, calendar rescheduling, Pomodoro, routing and auth, stats summary | `npm test` | nothing |
| End to end | Real browser, real Flask, real MySQL: create/complete/delete a task, quick-add, a recurring task on the calendar, a Pomodoro session, register/login/logout, cross-user access | `npm run test:e2e` | MySQL, Chromium |

## Backend (`task-manager-backend`)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest                      # everything
python -m pytest tests/unit           # no database needed
python -m pytest tests/services/test_recurrence.py -v
```

The tests need a MySQL server (the queries use `MATCH ... AGAINST` and `TIMESTAMPDIFF`, so SQLite will not do). They connect with `DB_HOST`, `DB_PORT`, `DB_USER` and `DB_PASSWORD` (defaults `127.0.0.1`, `3306`, `root`, empty) and **always** use a database called `task_manager_test`, which is created if missing and truncated between tests. `DB_NAME` from your `.env` is ignored, so a real database is never touched. If you have no local MySQL, a throwaway one matches CI:

```bash
docker run -d --name taskflow-test-mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 127.0.0.1:3307:3306 mysql:8.0
DB_PORT=3307 python -m pytest
```

Layout: `tests/unit` (no database), `tests/services` (service functions in an app context), `tests/functional` (HTTP through the Flask test client). Fixtures in `tests/conftest.py`: `make_user`, `login` (a client holding real session cookies), `task_payload`. External services are mocked at `ai_service.get_generated_text` and the mailer; rate limits are reset per test. Dates in recurrence tests are fixed (March 2026), and `test_stats_service.py` freezes the clock by patching `stats_service.datetime`.

## Frontend (`task-manager-frontend`)

```bash
npm ci
npm test                  # Vitest, jsdom
npm run test:watch
npm run lint && npm run typecheck && npm run build
```

Tests sit next to the code (`*.test.ts(x)`). `src/test/render.tsx` provides `renderWithProviders` (router, a fresh `QueryClient` with retries off, task context) and `makeTask`. HTTP is mocked at the axios client with `axios-mock-adapter`, so the real hooks, cache and components run. The timezone is pinned to UTC in `vitest.config.ts`, and `src/test/setup.ts` stubs the browser APIs jsdom lacks (`ResizeObserver`, `matchMedia`, audio, storage).

## End to end (`task-manager-frontend/e2e`)

```bash
npx playwright install chromium       # once
npm run test:e2e                      # starts Flask and Vite itself
npm run test:e2e:ui                   # Playwright's UI mode
```

`playwright.config.ts` starts the API with `python -m tests.e2e_server` (from the backend folder, using its `venv` if present, or set `E2E_PYTHON`) and `npm run dev`. The API server:

- only connects to a **local** MySQL and only to the `task_manager_e2e` database, which it creates and empties on start (it exits otherwise). Set `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USER`, `E2E_DB_PASSWORD` if your server is not `root` on `127.0.0.1:3306`;
- ignores your `.env`, disables rate limits and replaces the AI providers with a fixed stub, so no AI request is made;
- uses ports 5001 (API, `E2E_API_PORT`) and 5173 (web), which must be free for the API.

Each test registers its own user, so tests do not depend on each other. Analytics requests are blocked. Time is fixed with `page.clock.setFixedTime`, which keeps the calendar on a known month.

## Known bugs pinned by tests

Tests for confirmed bugs are written for the **correct** behaviour and marked as expected failures, so the suite stays green and flips to a failure (telling you to remove the marker) once the bug is fixed.

- Backend: `@pytest.mark.xfail(strict=True, reason=...)`. Show them with `python -m pytest -rx`; run them as plain tests with `--runxfail`.
- Frontend: `it.fails(...)`.

| Where | Bug |
| --- | --- |
| `services/test_recurrence.py` | Occurrences on the last day of a date-only range are dropped |
| `services/test_recurrence.py` | Monthly repeats drift after a short month (31 Jan, 28 Feb, 28 Mar) and the drift is saved when a task is completed |
| `services/test_recurrence.py` | Ghosts are repeated on every page of a paged list |
| `functional/test_ai_routes.py` | Quick-add returns 500 when every AI provider fails |
| `services/test_stats_service.py` | A completed repeating task is counted once per projected day |
| `features/tasks/taskMutations.test.tsx` | Skipping a ghost occurrence sends the ghost id to the API |
| `utils/validators.test.ts` | Task update validation never checks `startAt` (typo `starAt`) |
| `features/tasks/utils.test.ts` | `formatDateRelative()` throws when called without a date |
| `features/tasks/components/TaskForm.test.tsx` | A pristine form is not validated before the first submit |

## Conventions

- Test behaviour a user or API client can observe, not internals. Prefer roles and labels over test ids.
- No `sleep`s. Wait on a condition (`findBy*`, `waitFor`, `expect.poll`, Playwright auto-waiting).
- Use fixed dates. Never depend on today's date.
- Keep each test independent: a fresh user, a fresh `QueryClient`, no shared state.
- Add a regression test with the fix for any bug; if the fix is not ready, add it as an expected failure as above.
