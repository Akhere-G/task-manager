# TaskFlow audit: findings

> Audit date: 2026-10-22. Companion specs for each fix are in this folder (see [README.md](README.md)). Scope decisions: M1 (dependency bumps) and L10 (repo hygiene) are reported here but have no fix spec. For H3 the hardcoded password was confirmed **not a real secret**, so no rotation or history rewrite is needed.

Repo: `task-manager/` (Flask + SQLAlchemy + MySQL backend, React/Vite/TS frontend, one root `Dockerfile` serving both). No `CLAUDE.md` exists; I used `README.md` and `docs/specs/public-demo-mode.md`. Git tree was clean. No application code was modified by the audit.

Status key: **Confirmed** = visible in code or tool output. **Confirmed (trace)** = confirmed by reading the code path, not reproduced at runtime. **Potential** = depends on deployment or load I could not observe.

---

## 1. Executive summary

The codebase is tidy and security-conscious in the basics. Every task, notification and stats query is scoped by `user_id`. All SQL is parameterised. The PATCH path uses a field whitelist. Markdown output is restricted to a few elements. `.env` is untracked, and a history scan found no API-key patterns. TypeScript compiles clean and ESLint on `src/` is clean.

I found **no critical issue and no confirmed injection or authorisation bypass**. The material risks are:

1. **A user-facing auth bug (H1)** that very likely breaks the password-reset email link and direct visits to public pages when logged out.
2. **A token-refresh race (H2)** that can log users out at random.
3. **No abuse protection anywhere (H4, H5)**: login, register, reset, contact and the LLM endpoints are open, and `POST /api/auth/demo` hands anyone a session.
4. **Config and secret hygiene (H3, M3, M4)**: a hardcoded fallback DB password in source and git history, DB pool settings that are never applied, and a remote DB connection with no TLS configured.
5. **Fragile operations (M11, M12)**: broken secondary Dockerfile and compose file, a single gunicorn worker, and **zero tests and no CI**.

Totals: 0 Critical, 5 High, 14 Medium, 10 Low. Most High and Medium fixes are small (Small effort).

---

## 2. Findings

### High

**H1. Logged-out deep links are bounced to `/login`, which breaks the password-reset link.** Bug / User flow. *Confirmed (trace)*
- Evidence: `task-manager-frontend/src/services/api.ts:18-27`, `src/context/AuthContext.tsx:39-55`.
- Problem: On every page load `AuthContext` calls `GET /auth/me`. For a logged-out visitor that returns 401, the interceptor calls `/auth/refresh`, which also returns 401. The interceptor then runs `window.location.href = "/login"` unless the path is `/login` or `/register`. There is no allow-list for the other public routes (`/reset-password`, `/login/request-password-reset`, `/demo`, `/about`, `/contact`).
- Impact: A user clicking the emailed link `/reset-password?token=…` in a fresh session is redirected to `/login` and the token is lost. Direct links to `/demo`, `/about` and `/contact` bounce as well, and the README "Try the demo" link is one of them. A re-login is required.
- Fix: Do not hard-redirect in the interceptor. Let `AuthContext` and `ProtectedRoute` decide, and skip the refresh retry for `/auth/me` and `/auth/refresh`. Keep the `session_expired` analytics event only when the user was previously authenticated.
- Effort: Small. Verify at runtime by opening `/reset-password?token=x` logged out.

**H2. Concurrent 401s trigger parallel refreshes with single-use rotating tokens, so users can be logged out.** Bug / Reliability. *Confirmed (trace)*
- Evidence: `api.ts:28-32`, `app/services/auth_service.py:148-150`, `app/routes/auth_routes.py:289-314`.
- Problem: Each failed request independently calls `POST /auth/refresh`. The server deletes the old refresh token and issues a new one, with no reuse grace and no single-flight on the client. When the access JWT expires and the Home page fires several queries at once, the second refresh fails with 401 and the interceptor redirects to `/login`.
- Impact: Intermittent forced logouts after the 24h access token expires. Cookies have no `max_age` (see L1), so they are session cookies anyway.
- Fix: Share one in-flight refresh promise in the interceptor, and have the server tolerate the previous token for about 10 seconds.
- Effort: Small. Group with H1.

**H3. Hardcoded fallback DB password in source and git history.** Security / Secrets. *Confirmed*
- Evidence: `task-manager-backend/app/main.py:29`. The value is in 3 historical diffs, introduced in the first auth commit `95e2d64`. `JWT_SECRET_KEY` (`main.py:41`) has no fail-fast, so a missing secret only fails at first token creation.
- Impact: If the value was ever a real credential, anyone with repo access has it. A deployment that forgets `DB_PASSWORD` silently uses it. The local `.env` does not use this value, so it may be stale. I could not check production.
- Fix: Remove the default. Raise at startup if `DB_PASSWORD` or `JWT_SECRET_KEY` is missing. Rotate the DB password if it was ever used. Do not rewrite git history unless the repo is public and the password was real.
- Effort: Small.

**H4. No rate limiting or lockout on login, register, password reset and contact.** Security / Abuse. *Confirmed (absence)*
- Evidence: No limiter in `requirements.txt` or `app/`. Routes: `auth_routes.py` (register, login, request-password-reset), `mail_routes.py:39`.
- Impact: Credential stuffing and brute force on `/auth/login`. `/api/contact` is unauthenticated and sends a MailerSend email per call, so it can be used for spam and quota exhaustion. `/auth/request-password-reset` can mail-bomb any address.
- Fix: Add Flask-Limiter with a shared backend, since Cloud Run runs multiple instances and an in-memory store is per-instance. Start with login and reset (per IP and per email), contact (a few per hour per IP) and register. Add a global per-IP limit. Cloud Armor or edge limits are an alternative.
- Effort: Medium.

**H5. Uncapped, anonymously reachable LLM usage (cost abuse).** Security / Cost. *Confirmed (absence); impact Potential*
- Evidence: `app/routes/ai_routes.py:27-58`, `app/services/ai_service.py:30-56`, `auth_routes.py:159-194`.
- Problem: `POST /api/auth/demo` gives any visitor a session. `parse-task` and `decompose` then call Gemini or Groq with no quota and no input-length cap. The Gemini call has no timeout. `docs/specs/public-demo-mode.md` records "no rate limiting" as an accepted decision. I recommend revisiting it because cost exposure grows with traffic.
- Fix: Cap input length (title and description, for example 500 and 2,000 characters). Add a DB-backed per-user daily AI-call counter with a tighter limit for the demo user. Set provider-side spend caps and a Cloud Run max-instances limit. Add a timeout to the Gemini call.
- Effort: Small to Medium.

### Medium

**M1. Dependencies with known advisories.** Security / Supply chain. *Confirmed (advisories exist); exploitability mostly low*
- Frontend (`npm audit --omit=dev`): 8 findings (6 high). `react-router` 7.13.0 (affected range up to 7.18.1) carries many advisories. Most concern framework/RSC/SSR modes this SPA does not use (`BrowserRouter`), but two open-redirect advisories involving `<Link>` and `useNavigate` could apply. `moment` (transitive via `react-big-calendar`) has a locale path-traversal advisory. `npm audit fix` is offered.
- Backend (OSV batch query of `requirements.txt`): advisories listed for Flask 3.1.2 (fix 3.1.3), Werkzeug 3.1.5 (3.1.9), PyJWT 2.11.0 (2.15.0), cryptography 46.0.5 (50.0.0), urllib3 2.6.3 (2.8.0), requests 2.32.5 (2.33.0), python-dotenv 1.2.1 (1.2.2), certifi (2026.10.19) and others. I did not triage each one. Most PyJWT items concern JWK/JWKS/PEM paths this app does not use (it uses an HS256 secret). The Flask, Werkzeug, urllib3 and requests items are worth taking.
- Fix: Bump, run a smoke test, and enable Dependabot or Renovate. Remove unused packages (see L5), which also shrinks the exposure.
- Effort: Small.

**M2. The global error handlers leak internals and mis-report errors.** Bug / Info leak. *Confirmed*
- Evidence: `main.py:98-101` (404 handler), `main.py:103-120` (500 and `Exception` handlers return `str(e)`). Many routes return `str(e)` too (`auth_routes.py:119,156,194,208,223,258,285,314`, `ai_routes.py:24,39`). `request.json` is `None` or raises on bad input at `task_routes.py:74,94,131`, `ai_routes.py:31,45` and `mail_routes.py:40`.
- Problems: (a) `errorhandler(Exception)` catches Werkzeug `HTTPException`s (bad JSON 400, 415, 405) and turns them into 500s with the exception text. (b) The 404 handler returns `index.html` with status 200 for unknown `/api/*` URLs. (c) DB, driver or mailer errors are echoed to clients. (d) The first handler logs via `print`.
- Impact: Information disclosure, misleading monitoring (client errors counted as 500s), and API clients that cannot detect missing routes.
- Fix: Handle `HTTPException` separately and return JSON with the right status. Return JSON 404 for `/api/*` and `index.html` only for non-API GETs. Return generic messages and log with `logging` and a traceback. Use `request.get_json(silent=True) or {}` with type checks.
- Effort: Medium (touches every route file but is mechanical). Do before H4/M9/M10 so validation errors surface as 400s.

**M3. SQLAlchemy pool settings are never applied to the real app.** Reliability. *Confirmed*
- Evidence: `app/database.py:21-26` sets `pool_pre_ping` and `pool_recycle=280` on a throwaway second `Flask(__name__)`. `main.py:create_app` sets only `SQLALCHEMY_DATABASE_URI`, so Flask-SQLAlchemy uses its default `pool_recycle=7200` (confirmed in the installed `flask_sqlalchemy/extension.py:640`) and no pre-ping.
- Impact: With a remote managed MySQL that drops idle connections, the first request after idle can fail ("server has gone away"). The `/api/keep-alive` endpoint looks like a workaround for this.
- Fix: Set `SQLALCHEMY_ENGINE_OPTIONS` in `create_app`. Delete the unused Flask app in `database.py`.
- Effort: Small. Group with H3.

**M4. DB connection is not configured for TLS.** Security. *Confirmed config; impact Potential*
- Evidence: `DB_HOST` in `task-manager-backend/.env` is non-local (checked by shape only). Neither `main.py:38`, `database.py:34` nor `init_db.py` passes `ssl`/`ssl_ca`. `init_db.py:43` computes `ca_path` and never uses it. `ca.pem` is copied into the image but unused.
- Impact: PyMySQL does not use TLS unless asked, so credentials and data (including password hashes) may cross the network in cleartext, unless the provider forces TLS at the proxy level. I could not check the provider.
- Fix: Pass `connect_args={"ssl": {"ca": <path>}}` for the app engine, `SessionLocal` and `init_db`. Verify the provider's TLS requirement first.
- Effort: Small.

**M5. `refresh_tokens` grows without bound and has no index on `token`.** Performance / Reliability. *Confirmed*
- Evidence: `init_db.py:113-120` (no index or unique key on `token`, though `app/models/users.py:34` declares `unique=True`). `auth_service.py:111-126,137-145`. No cleanup anywhere.
- Impact: Every login, register, refresh and anonymous `POST /auth/demo` inserts a row. Expired rows are never purged. `WHERE token = ?` is a full scan on every refresh and logout, so cost grows with the table. Anonymous callers can inflate the table.
- Fix: Add a unique index on `token` (idempotently in `init_db.py`). Purge expired rows (a scheduled job or opportunistic delete on login). Reuse or limit demo sessions per client. Apply the same expiry purge to `password_resets`.
- Effort: Small.

**M6. Sessions survive a password reset; tokens are stored in plaintext.** Security. *Confirmed*
- Evidence: `auth_service.py:97-108` (reset does not delete the user's `refresh_tokens`), `auth_service.py:74-83` (reset token stored raw), `auth_service.py:137-145` (refresh token stored raw). Logout cannot revoke the 24h access JWT.
- Impact: An attacker with a stolen session stays signed in for up to 7 days after the victim resets their password. A DB read leak exposes usable reset and refresh tokens (the reset token is valid 15 minutes).
- Fix: Delete all of the user's refresh tokens on password reset. Store SHA-256 hashes of reset and refresh tokens. Optionally add a `token_version` claim for access-token revocation.
- Effort: Small to Medium.

**M7. Repeating-task completion is not atomic and not concurrency-safe; PATCH validation misses merged values.** Bug / Data integrity. *Potential (not reproduced)*
- Evidence: `task_service.py:185-251`, `task_utils.py:146-177`. `handle_repeat_task` commits mid-request, the task row is read without `FOR UPDATE`, and the response dict is built before the dates advance.
- Impact: A double-click or client retry on "complete" can create duplicate history rows and advance the series two periods. A PATCH with only `endAt` (or only `startAt`) is not checked against the stored value, so `end <= start` can be stored (`validators.py:56-58` only compares fields present in the request).
- Fix: Use `with_for_update()` and a single transaction. Compare merged start and end on updates. Return the persisted state.
- Effort: Medium.

**M8. The reminder job notifies for completed tasks, has no de-duplication, and formats "None".** Bug. *Confirmed (code); frequency Potential*
- Evidence: `app/run_reminders.py:66` (no `is_completed` filter, scans all users), `:81` (`f"{category} -- {description}"` shows "None"), `:36-44` (sequential `webpush` with no timeout). The first line is a leftover debug print.
- Impact: Reminders for tasks already done. If the job runs more often than every 30 minutes, the same task is notified repeatedly, and a `Notification` row is inserted each time. I do not know the schedule.
- Fix: Add `is_completed == False`. Track the last reminder (a column or a unique key on user, task, start time). Guard null descriptions. Add a push timeout.
- Effort: Small to Medium.

**M9. The task list endpoint has unbounded work and uncaught bad input.** Performance / Reliability. *Confirmed (trace)*
- Evidence: `task_utils.py:55-119` (`with_repeating`), `task_service.py:53,84-95`, `task_routes.py:18-50`.
- Problems: `project_repeating=true` with a huge `start_date`/`end_date` range generates a ghost task per period per recurring task. For example, a 100-year range with a daily task produces about 36,500 items per task. With no `limit` the endpoint returns every row. A missing date range with `project_repeating=true` crashes (`None.replace`). Invalid `page`, `limit` or dates raise `ValueError` and return 500.
- Impact: One authenticated request can burn CPU and memory on the single gunicorn worker (M11).
- Fix: Clamp the range (for example 400 days), cap `limit` (for example 200), and validate query params into 400s.
- Effort: Small.

**M10. Search input is passed raw to MySQL boolean-mode full text.** Bug. *Confirmed (trace)*
- Evidence: `task_utils.py:23-28` (`AGAINST(:search IN BOOLEAN MODE)` with `search + "*"`).
- Impact: Not SQL injection (it is bound), but operator characters (`"`, `(`, `+`, `-`, `@`) can cause a syntax error and a 500. Terms below `innodb_ft_min_token_size` (default 3) match nothing. Only the last word gets the wildcard.
- Fix: Strip operators, tokenise, append `*` to each term, and fall back to `LIKE` for short terms.
- Effort: Small.

**M11. Deployment artifacts are fragile or broken.** Reliability / Security. *Confirmed; impact depends on the build path*
- Evidence:
  - `Dockerfile:42-43`: gunicorn runs with defaults, so 1 sync worker and a 30 s timeout. It runs as root and uses `npm install` instead of `npm ci`. `start.sh` has no `set -e`, and `init_db.py` swallows step failures (`run_step`), so the app starts on a half-migrated DB.
  - `task-manager-backend/Dockerfile:32-34`: runs `python app/init_db.py` (the file is `init_db.py`) and `app.main:app` (no module-level `app` exists), so this image cannot start.
  - `docker-compose.yml`: builds `./backend` and `./frontend`, which do not exist, maps `5173:80` while nginx listens on 8080, uses different build-arg names, and hardcodes a root DB password.
  - No `.dockerignore` at the repo root, which is the root Dockerfile's build context. `task-manager-backend/.dockerignore` does not apply there. A local `docker build` would copy `venv/` (224 MB), `app/node_modules` (27 MB) and `task-manager-backend/.env` into the image.
- Impact: One slow AI call blocks every other request. A local build can bake secrets into an image. Compose and the backend Dockerfile mislead contributors.
- Fix: Add `--workers 2-4 --threads 4 --timeout 60` (size to the Cloud Run instance). Use a non-root user. Add a root `.dockerignore`. Delete or fix `docker-compose.yml` and `task-manager-backend/Dockerfile`. Make migration failures fatal, or log them loudly.
- Effort: Small to Medium.

**M12. No tests and no CI.** Testing. *Confirmed*
- Evidence: There are no test files and no `.github/` or other CI config. `pytest` is installed in the local venv but not in `requirements.txt`; `docs/specs/public-demo-mode.md` says the tests were removed. There is no frontend test runner.
- Related: `npm run lint` (`eslint .`) reports about 4,700 errors because `eslint.config.js` has no ignores for `dist/`, `dev-dist/` and `task-manager-backend/app/node_modules/`. `src/` is clean on its own, and `tsc` is clean.
- Impact: The riskiest logic (auth rotation, recurring-task completion and projection, ownership scoping) is untested, and nothing blocks a broken merge.
- Fix: Add ignores to ESLint. Add a CI workflow running `eslint src`, `tsc`, `vite build`, and `pytest` against a MySQL 8 service container (FULLTEXT, `timestampdiff` and the trigger are MySQL-specific). First tests: auth login/refresh/rotation, per-user isolation on every task route, recurring-task completion, `with_repeating`, validators.
- Effort: Medium to Large for the full set; Small for lint, typecheck and build only.

**M13. Stats and the daily brief load every task into Python.** Performance. *Potential*
- Evidence: `stats_service.py:285-329` fetches all of a user's tasks and projects 30 days of ghosts, then loops over them 11 times. `generate_daily_brief` calls it plus `get_all_tasks`.
- Impact: Fine for tens or hundreds of tasks. It becomes slow and memory-heavy for power users or imported CSVs, on the single worker. `_get_estimation_accuracy` (`:203-204`) uses naive `.timestamp()`, which assumes server-local time, while the rest assumes UTC.
- Fix: Defer until measured. Then aggregate in SQL (GROUP BY on category, status and day) or cache per user for a minute. Add composite indexes such as `(user_id, end_at)` and `(user_id, is_completed)` if scans show up.
- Effort: Medium to Large.

**M14. AI provider handling is brittle.** Reliability. *Confirmed (code)*
- Evidence: `ai_service.py:30-56` (new client per call, bare `except: pass`, no Gemini timeout, the two providers get different system prompts), `:131-142` (two concurrent first-of-day requests hit `unique_user_day`, are caught by the broad `except`, and the user sees the "wobble" text), `:61` (`date.today()` is server-local time, not the user's day).
- Impact: Hung requests, silent failure with no logs, a "success" response carrying an error message, and wrong-day briefs for users outside the server timezone. I could not confirm that the model name `gemini-3.5-flash` exists, so verify it.
- Fix: Add a timeout, log provider failures, catch `IntegrityError` on the brief insert and re-read, and return a non-200 or a flagged response on fallback. Pass the user's timezone from the client.
- Effort: Small to Medium.

### Low

- **L1. Cookie and CSRF hardening.** `JWT_COOKIE_CSRF_PROTECT=False` (`main.py:47`) with `SameSite=None` when Secure (`main.py:51-54`, `auth_routes.py:32-53`). Practical risk is limited: Flask rejects non-JSON bodies, and PATCH/DELETE need a CORS preflight against a single allowed origin. The residual exposure is bodiless POSTs (`logout`, `refresh`, `demo`). Because production serves the SPA and API from one origin, `SameSite=Lax` would be enough. `JWT_COOKIE_SECURE` fails open (defaults to false when unset). Cookies have no `max_age`, so the 7-day session is lost when the browser closes. Effort: Small. *Potential.*
- **L2. Contact email HTML injection.** `mail_routes.py:18-23` interpolates `fullName`, `email`, `subject` and `message` unescaped into HTML mailed to the owner. `validators.py:136-155` crashes on non-string values. `MAIL_USERNAME` is the recipient but is missing from `.env.example`. Fix: `html.escape` and type checks. Effort: Small. *Confirmed.*
- **L3. Reset-flow polish.** `auth_routes.py:236-258` returns 500 with the mailer error for existing accounts when MailerSend fails, so existence leaks. `FRONTEND_URL` unset yields a `None/reset-password` link. The password policy is minimal (8+ characters, letter plus digit, no common-password check), and passwords are silently `.strip()`ped. Login does a hash check only when the user exists (timing signal). Effort: Small. *Confirmed.*
- **L4. Docs and analytics drift.** `analytics.ts:56-58` has a hardcoded PostHog project key fallback, so analytics are on by default in dev and forks, contradicting the README ("off unless configured"). `analytics.ts:62-63` logs to the console in production. `api.ts:5-7` falls back to the production API URL. The README says Pomodoro sessions are "automatically logged against your tasks", and I found no logging call (it only marks the task complete). Task titles go to third-party LLMs (`ai_service.py:104-109`) and no privacy note says so. `.env.example` is missing `FRONTEND_URL`, `FRONTEND_DOMAIN`, `MAIL_USERNAME`, `MAIL_PASSWORD` and `VAPID_PRIVATE_KEY`. Effort: Small.
- **L5. Maintainability.** The task-to-dict mapping is copied five times (`task_service.py:59-75,114-129,193-206,232-245`, `stats_service.py:292-310`). The schema lives in three drifting places (`init_db.py`, `schema.sql`, the models): the models say `String(100)`/`255` against 50/100 in the DB, `PasswordReset` primary key differs, and `schema.sql` uses `CREATE FULLTEXT INDEX IF NOT EXISTS`, which MySQL does not support. There is no migration tool. `init_db.py:57` does `CREATE DATABASE` after already connecting to that database. Unused pinned packages: `openai`, `genai` (a different package from `google-genai`), `tiktoken`, `aiohttp`, `beautifulsoup4`, `ipython`, `jedi` and others. Fix: one `task_to_dict`, adopt Alembic when convenient, trim `requirements.txt`. Effort: Medium.
- **L6. Frontend code smells.** `useTasks.ts` mutates `searchParams` in place (`:70-79`) and calls `setSearchParams` inside `queryFn` (`:146-150`). `DEFAULT_FILTERS.currentDate` is frozen at import (`:41`) and goes stale across midnight. `Pomodoro.tsx` calls `navigate(-1)` during render. `Settings.tsx:198-234` has dead `FutureSections`. `useEffect` deps are incomplete. Effort: Small.
- **L7. SEO and static serving.** `public/robot.txt` should be `robots.txt` (and its Sitemap line points at a Railway domain). `sitemap.xml` also uses the Railway domain, not the live Cloud Run host. Flask serves static files with no gzip or explicit cache and security headers; `nginx.conf` is unused in the root image. The main bundle is about 635 KB uncompressed in the existing `dist/` (pages are already lazy-loaded). Effort: Small.
- **L8. CSV export formula injection.** `Settings.tsx:40-46` `escapeCSV` does not neutralise a leading `=`, `+`, `-` or `@`, so a task titled `=HYPERLINK(...)` becomes a formula in Excel. Self-inflicted unless tasks arrive via CSV import or AI. Effort: Small. *Confirmed.*
- **L9. Notifications.** `get_notifications` is unbounded and unordered (`app/services/notification.py:6-8`). `save_subscription` reassigns an existing endpoint to the caller (`:33-37`), a risk the spec already accepts.
- **L10. Repo hygiene.** A 5 KB untracked root `.env` holds no `KEY=VALUE` lines (93 lines of other content); review and delete it. `dev-dist/registerSW.js` (generated) is tracked. `task-manager-backend/app/node_modules/` (27 MB of `date-fns` copies) is a stray directory. `main.py:130` runs `debug=True` if executed directly (local only).

---

## 3. Checks not performed

- No runtime testing: I did not start the app, a database or a browser, and did not hit the live site. H1 and H2 are code-trace conclusions and should be reproduced before relying on them.
- No access to production: I did not inspect Cloud Run settings, IAM, the real DB (indexes, TLS enforcement, `innodb_ft_min_token_size`), scheduler cadence for `run_reminders.py`, or how images are built and deployed.
- Dependency checks: `npm audit` (production dependencies) and an OSV batch query of the pinned Python versions only. I did not triage exploitability for every Python advisory, run `pip-audit`, or check dev dependencies.
- Secrets: I inspected `.env` files by key names and shape only and did not read values. The history scan covered common key patterns (Groq, Google, MailerSend, private keys) plus the hardcoded password. It is not exhaustive.
- Code coverage: I read all backend source and the frontend's API, auth, task hooks, utilities, Settings, Demo, Pomodoro, bulk-add and daily-brief code. I did not review every component (charts, `Header`, `Footer`, `TaskCalendar`, `TaskForm`, `DecomposeTask` in full), accessibility, or visual behaviour.
- Performance and bundle size: no profiling, load testing or fresh build. The bundle size comes from the existing, possibly stale `dist/`.
- Model names (`gemini-3.5-flash`, `openai/gpt-oss-20b`) were not verified against provider catalogues.

## 4. Verification (for when fixes are approved)

- H1/H2: run the SPA against a local backend, open `/reset-password?token=x` and `/demo` logged out (no redirect), then let the access token expire and load Home to confirm a single refresh and no logout.
- Backend items: pytest against a MySQL 8 container. Add isolation tests (user A cannot read, patch or delete user B's tasks) and a duplicate-completion test for M7.
- Config items: boot with `DB_PASSWORD` and `JWT_SECRET_KEY` unset (should fail fast). Confirm TLS from the DB side (`SHOW STATUS LIKE 'Ssl_cipher'`).
- Deploy items: `docker build` from the repo root and inspect the image for `.env`, `venv/` and `node_modules`.

