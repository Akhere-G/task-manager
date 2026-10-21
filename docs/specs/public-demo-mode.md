# Public Demo Mode — Implementation Specification

> **Status:** Implemented (uncommitted). Verified against a throwaway local MySQL; **nothing has been run against any real/production database.** Deviations from this spec as written:
> - `is_demo_user()` lives in `app/services/auth_service.py` (not `app/demo/__init__.py`, which only holds `DEMO_USER_EMAIL`), to avoid an import cycle.
> - `create_session()` picks the 24 h demo lifetime itself (by looking up `is_demo`) instead of taking a `ttl` argument, so token rotation in `/auth/refresh` keeps the demo lifetime too.
> - `tzdata` was added to `requirements.txt` (data-only; `zoneinfo` needs it on minimal images) alongside `pytest`.
> - `init_db.py` now runs each migration step separately and prints `Migration step ok/FAILED: <name>`.
> - Tests: `task-manager-backend/tests/` (69 tests; run with `DB_NAME=<name>_test`, see `tests/conftest.py`).
>
> **Decisions recorded (from review):**
> 1. Projects and priority are **out of scope** (not modelled, not mentioned in the UI or fixture).
> 2. Existing AI functionality is **left exactly as is**: no new rate limiting, quotas or demo-specific AI behaviour.
> 3. `run_reminders.py` is **left alone**.
> 4. One **shared, writable** demo account.
> 5. **No feature flags.** The deliverable includes making the database migration actually work (§5).

---

## 1. Context

Recruiters should be able to click **Try demo** and land in a populated TaskFlow account with no registration. The demo uses the existing cookie-JWT authentication unchanged in shape: the same `access_token_cookie` + rotating `refresh_token` cookie, the same `/api/auth/me` session check, the same `User` payload.

Approach (as requested):

- Add `users.is_demo` (boolean).
- Add an **idempotent seed/reset script** that finds-or-creates one designated demo user, deletes *only that user's* data, and recreates it from a committed JSON fixture.
- Add one new endpoint, `POST /api/auth/demo`, that issues a session for that user.
- Reuse every existing page, component and data hook. New frontend code is one page, one banner and a few lines of wiring.

### 1.1 What the code actually contains (findings that shape the design)

| Area | Finding | Consequence for the demo |
|---|---|---|
| **Tables** | `users`, `tasks`, `daily_briefs`, `notifications`, `notification_subscriptions`, `refresh_tokens`, `password_resets` (`app/models/*`, `init_db.py`). | These are the only things that can be seeded or must be cleaned on reset. |
| **Task state** | A task has `is_completed` (+`completed_at`). "Overdue" is *derived*: `not is_completed and end_at < now` (`stats_service.py`, frontend `Pomodoro.tsx`). | Variety is shown through completed / pending / overdue and through category, duration and dates. |
| **Subtasks** | `/api/ai/decompose` returns tasks and `/api/tasks/bulk` stores them as **ordinary, unlinked tasks** (`DecomposeTask.tsx` → `createAll`). There is no parent id. | An "AI-decomposed" example is a parent task plus sibling tasks created at the same moment, with no relationship column. |
| **Task columns** | `title, description, category, is_completed, start_at, end_at, created_at, completed_at, is_repeating, repeat_by(daily/weekly/monthly/yearly), repeat_until(DATE), series_id, user_id`. Datetimes are **naive UTC**. | Fixture maps 1:1 onto these. |
| **Categories** | Validated against 11 values (`validators.py`): work, home, chores, life-admin, health, self-care, social, hobbies, learning, finance, general. | Fixture validator enforces the same list. |
| **Recurring tasks** | A series is **one "master" row** (`is_repeating=1`, `series_id = own id`) whose `start_at/end_at` is the *next uncompleted occurrence*. Future occurrences are **projected, not stored** (`with_repeating` → "ghost" tasks with id `ghost_<id>_<yyyymmdd>`). Completing the master (`update_task` → `check_should_repeat` → `handle_repeat_task`) inserts a **history row** (`is_repeating=0, is_completed=1, series_id = master id, same start/end/created_at`) and advances the master by one period, resets `is_completed=0`, `completed_at=NULL` and sets `created_at = now`. Skipping just moves the master forward (no row). `repeat_until` is a DATE; once the last occurrence is completed the master simply stays completed. | Seeded recurrence must be *exactly this shape*: master = next occurrence, history rows = past completed occurrences, no stored future rows. Generator in §6.3 reproduces `handle_repeat_task` output. |
| **AI** | `GET /api/ai/daily-brief` (cached per `(user_id, generated_date = date.today())` in `daily_briefs`, otherwise calls Gemini → Groq), `POST /api/ai/parse-task`, `POST /api/ai/decompose` (both live LLM calls, no quotas). | **Left unchanged.** Today's brief is still seeded so the demo opens with a brief immediately; `parse-task` and `decompose` behave as for any user. |
| **Auth** | `login` / `register` / `refresh` mint a 24 h access JWT + a DB-backed 7-day refresh token, set as httpOnly cookies; `JWT_COOKIE_CSRF_PROTECT=False`; user dict `{id, first_name, last_name, email}` is camel-cased by `format_json_response`. Frontend `AuthContext` calls `/auth/me` on load. | Demo login returns the same shape (+`isDemo`). No new auth mechanism. |
| **DB schema management** | **No Alembic.** Schema = `init_db.py` (raw SQL) and a stale `schema.sql`. The root `Dockerfile` `start.sh` runs `python -m app.init_db`, but the file is `task-manager-backend/init_db.py` (copied to `/app/init_db.py`), so that command fails with "No module named app.init_db" and, with no `set -e`, startup silently continues to gunicorn. **In the container, migrations never run today.** Separately, `init_db` wraps everything in one `try`, and its `ALTER TABLE tasks ADD FULLTEXT` **fails on every re-run**, skipping everything after it (the completion trigger and the `series_id` backfill). | §5 makes the migration path actually work: fix the invocation, make `init_db` safely re-runnable, and add `is_demo` idempotently. |
| **MySQL trigger** | `tr_ensure_completion_timestamp` (BEFORE UPDATE on `tasks`) forces `completed_at=NOW()` when `is_completed=1 AND completed_at IS NULL`, and `completed_at=NULL` when `is_completed=0`. It fires on UPDATE only. | Seed inserts rows with final values, then does one UPDATE to set `series_id`; completed rows always carry a non-null `completed_at`, so the trigger is a no-op (validated, tested). |
| **FKs** | `ON DELETE CASCADE` exists in `init_db.py`, but the SQLAlchemy models omit `ondelete` on `notifications.user_id` / `notification_subscriptions.user_id`, so a prod DB may differ. `tasks.series_id` is a plain int (no FK). | Reset deletes children **explicitly, by `user_id`** and never relies on cascade or on deleting the user. |
| **Reminders** | `app/run_reminders.py` (separate process) scans *all* users' tasks starting in the next 30 min, inserts a `Notification` and web-pushes to subscriptions. | **Left unchanged.** It may insert `notifications` rows for the demo user; the reset deletes them. Demo can't register push subscriptions (next row), so no pushes go out. |
| **Notification subscribe** | `save_subscription` **re-assigns an existing endpoint to whichever user posts it** (`existing_sub.user_id = user_id`). | A recruiter who is also a TaskFlow user, in the same browser, could silently *steal their own real subscription* into the shared demo user. Must be blocked for demo (§8). |
| **Frontend routing** | `/` and all app pages are wrapped in `<ProtectedRoute redirect={!isAuthenticated}>` (redirects to `/register`); `/login`, `/register` use `redirect={isAuthenticated} redirectTo="/"`. Header nav is built in `App.tsx`. | New `/demo` route follows the `/login` pattern; "Try demo" links live on Login/Register and in the logged-out nav. |
| **Tests** | **None exist** (no pytest, no vitest). DB features used (FULLTEXT `MATCH…AGAINST`, `timestampdiff`, `GET_LOCK`, trigger) are MySQL-specific. | Backend tests need a real MySQL test database (§11). |
| **Local `.env`** | Repo has `ca.pem` and a gitignored `.env`; the DB is likely a remote managed MySQL. | **Scripts and tests must refuse to run against a DB that wasn't explicitly confirmed** (§7, §11). |

---

## 2. Goals / Non-goals

**Goals**
1. One click → authenticated demo session with rich, coherent data covering ~6 weeks (4 back, 2 forward).
2. Every existing feature shows meaningful data: list/filter/search, calendar (incl. ghost tasks), stats (all 11 charts), daily brief, Pomodoro, decompose, bulk add, export.
3. Reset is atomic, idempotent, scoped to the demo user, and safe to run on a schedule.
4. Real users and their data are unaffected in every code path.
5. Minimal diff; no new runtime dependencies; no feature flags.
6. Migrations work end to end (fresh DB and existing DB), so deploying the code is enough to add `is_demo`.

**Non-goals**
- No per-visitor sandbox accounts (one shared, writable account).
- No new rate limiting, quotas or changes to AI behaviour; no change to `run_reminders.py`.
- No change to registration, password policy or the login flow for real users.
- No Alembic adoption (noted as a separate improvement).

---

## 3. Architecture

```
Browser ──▶ [Login | Register | nav] "Try demo" ──▶ /demo (React page)
                                                      │ authService.demoLogin()
                                                      ▼
                              POST /api/auth/demo   (X-Requested-With header)
                                                      │ finds users.is_demo=1 AND email=DEMO_USER_EMAIL
                                                      │ create_access_token + create_session (same helpers as login)
                                                      ▼
                              Set-Cookie access_token_cookie / refresh_token
                                                      ▼
                    AuthContext: user{isDemo:true}, isAuthenticated=true → "/" (existing Home)

Any scheduler (cron / Cloud Scheduler job) ──▶ python -m app.demo.seed --confirm-db $DB_NAME   (every 6 h)
                                   │ one MySQL transaction, advisory lock, user-scoped DELETE + INSERT
                                   ▼
                    app/demo/fixtures/demo_data.json  (relative dates → resolved at run time)
```

Design decisions:

1. **Relative dates.** The fixture never stores absolute dates. Every timestamp is an offset from "now" in a declared timezone, so the dataset always looks like "the last 4 weeks and the next 2" and "today" is genuinely today. This is why reset must be **scheduled**, not run once.
2. **One shared demo user, stable `id`.** The user row is *updated, never deleted*, so cookies/refresh tokens of people mid-session survive a reset (their `user_id` is unchanged) and `refresh_tokens` rows are left alone except expired ones.
3. **The demo user has no usable password** (random hash, discarded), a reserved, undeliverable email (`demo@taskflow.invalid`, RFC 2606), and is rejected by `login_user` and the password-reset flow. The *only* way in is `POST /api/auth/demo`.
4. **No new runtime dependency, no feature flag, no new env vars.** The endpoint is always registered; until the seed has run it answers `503` and the UI shows a friendly error.

---

## 4. Files to create / modify

### Backend (`task-manager-backend/`)

| File | Change |
|---|---|
| `app/models/users.py` | **Modify.** `User.is_demo: Mapped[bool] = mapped_column(server_default="0")` (same style as `Task.is_completed`). |
| `init_db.py` | **Modify.** Make the migration work and re-runnable; see §5. |
| `../Dockerfile` (repo root) | **Modify.** `start.sh`: replace `python -m app.init_db` with `python init_db.py` (see §5). |
| `schema.sql` | **Modify** (keep in sync): add the column to `users`. |
| `app/services/auth_service.py` | **Modify.** (a) include `"is_demo"` in the dicts returned by `login_user`, `get_user`, `validate_refresh_token` (extract one `_user_dict(user)` helper rather than copy a 4th/5th time); (b) `login_user` returns `None` for `is_demo` users; (c) `create_session(user_id, ttl=timedelta(days=7))` gains an optional `ttl`; (d) new `get_demo_user()`. |
| `app/routes/auth_routes.py` | **Modify.** New `POST /api/auth/demo`; `request_password_reset` silently skips demo users (still returns the generic message). |
| `app/routes/notifications.py` | **Modify.** `subscribe` returns `403 {"error": "Not available in demo mode."}` for demo users. |
| `app/demo/__init__.py` | **Create.** `DEMO_USER_EMAIL = "demo@taskflow.invalid"` and `is_demo_user(user_id)` (used by the notifications route). |
| `app/demo/seed.py` | **Create.** Loader, validator, time-spec resolver, recurrence generator, transactional reset, CLI (`python -m app.demo.seed`). Mirrors `run_reminders.py` (own `SessionLocal`, no Flask app). |
| `app/demo/fixtures/demo_data.json` | **Create.** Full dataset, Appendix A. |
| `tests/` (`conftest.py`, `test_demo_fixture.py`, `test_demo_seed.py`, `test_demo_auth.py`) | **Create.** §11. |
| `requirements.txt` | **Modify.** Add `pytest` (dev). |

Explicitly **not** touched: `ai_routes.py`, `ai_service.py`, `run_reminders.py`, `task_service.py`, `.env.example` (no new env vars).

### Frontend (`task-manager-frontend/src/`)

| File | Change |
|---|---|
| `features/auth/types.ts` | `User.isDemo?: boolean`. |
| `features/auth/api.ts` | `demoLogin()` → `POST /auth/demo` with header `X-Requested-With: XMLHttpRequest` (already in the CORS allow-list). Returns `AuthResult`. |
| `context/AuthContext.tsx` | `loginAsDemo()` (same body as `login`: set user + `isAuthenticated`). `logout` already clears the query cache. |
| `pages/Demo.tsx` (new) | On mount (guarded by a `useRef` so React StrictMode doesn't fire two logins) calls `loginAsDemo()`; shows existing `LoadingState`; on failure shows existing `ErrorState` + link to `/login`. |
| `components/layout/DemoBanner.tsx` (new) + `index.ts` | Slim banner using existing Tailwind tokens: "You're exploring a shared demo with sample data that resets regularly. Please don't enter personal information." + **Exit demo** (calls `logout`). |
| `App.tsx` | Lazy `Demo` import; route `/demo` wrapped like `/login` (`redirect={isAuthenticated} redirectTo="/"` so a real signed-in user is never clobbered); add `{ title: "Try demo", path: "/demo" }` to `loggedOutRoutes`; render `<DemoBanner/>` when `user?.isDemo`; render `<NotificationsPrompt/>` only when authenticated **and not demo**. |
| `pages/Login.tsx`, `pages/Register.tsx` | A secondary-styled `<Link to="/demo">Try demo</Link>` (existing `btn-secondary` class). |
| `README.md` (root) | "Live demo" link (`<site>/demo`). |

The "Try demo" button is always rendered (no build flag); if the backend answers `503` the `/demo` page shows an error with a link back to Login.

No changes to Home, Calendar, Stats, Pomodoro, Decompose, Settings, hooks, or query keys.

---

## 5. Data model change

```sql
-- what init_db.py will execute (only if the column is missing):
ALTER TABLE users ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;
```

### 5.1 Making the migration work

There is no migration framework, and today's path is broken in two ways (§1.1). The fix is deliberately small and stays in the existing `init_db.py` style:

1. **Container invocation.** In the root `Dockerfile`, `start.sh` changes `python -m app.init_db` → `python init_db.py` (WORKDIR is `/app`, which contains `init_db.py` and `ca.pem`). Result: every deploy runs the migration before gunicorn starts.
2. **`users` table.** Add `is_demo BOOLEAN NOT NULL DEFAULT FALSE` to the `CREATE TABLE users` (fresh databases).
3. **Existing databases.** Add an idempotent step: query `information_schema.COLUMNS` for `users.is_demo` and `ALTER TABLE users ADD COLUMN …` only if absent (MySQL 8 has no `ADD COLUMN IF NOT EXISTS`). Existing rows get `FALSE`.
4. **Re-runnable.** Guard the remaining non-idempotent statement the same way: create the FULLTEXT index `idx_tasks_search` only if absent (`information_schema.STATISTICS`). This stops the re-run abort, so the completion trigger (`CREATE TRIGGER IF NOT EXISTS`) and the `series_id` backfill run on every start as intended.
5. **`schema.sql`** gets the same column so the two schema descriptions agree.

Behaviour to preserve: `init_db` keeps its current connection settings (TLS with `ca.pem`) and error handling (prints and continues), so a failed migration doesn't take the app down — but it must now **print which step failed**, and the verification in §11 checks the column exists after a run on both a fresh and an existing database.

Side effect to be aware of: because migrations now genuinely run at container start, the first deploy will also execute the (idempotent) trigger and backfill statements against production. Both are already the intended schema; take the §9 backup first.

### 5.2 Column semantics

- Default `FALSE` ⇒ every existing and future registered user is automatically non-demo.
- `is_demo` is **never accepted from any request body** (register/validators ignore it).
- Exactly one demo user is expected; its identity is `is_demo = 1 AND email = DEMO_USER_EMAIL` (both conditions, everywhere).

---

## 6. Fixture design

### 6.1 Narrative and how it maps to the schema

Persona: **Alex Taylor**, software engineer at a small start-up, preparing for the AWS Cloud Practitioner exam, training for a 5k, planning a long weekend in Lisbon. Fixture timezone `Europe/London` (matches the product's British-English AI persona and `europe-west2` deployment).

Interconnected threads (this is what makes the data read as one life rather than random rows):

| Thread | Rows |
|---|---|
| **AWS exam** (learning) | IAM → S3 → VPC labs (done) → practice exam (done yesterday) → RDS module (today) → IAM flash cards (tomorrow) → **exam** (D+13); weekly SQL course series that has *ended*. |
| **Release v2.4** (work) | Fix flaky CI → v2.3 release notes → retro (done) → refactor notification tests (**overdue**) → sprint demo slides → ship v2.4; weekly Team sync. |
| **Lisbon trip** (life-admin/social/finance/general) | Parent "Plan a long weekend in Lisbon" + five sibling tasks created in the same minute the day before (the exact shape produced by *Break it down* → bulk create); passport photos (done) → post passport renewal (upcoming); travel insurance/currency. |
| **Photos** (hobbies) | Edit holiday photos (done) → sort library into albums (**overdue, 3 weeks**) → print & frame a photo (upcoming). |
| **Money** (finance) | Monthly expenses (done) → budget spreadsheet (done) → pay credit card (done) → cancel streaming (**overdue**) → pension review (today) → tax receipts (upcoming); monthly **Pay rent** series. |
| **Health** | Daily **Morning run** series (≈17 completed days), parkrun, dentist, blood test, flu jab. |
| **Home/chores** | Bookshelf, tap, kitchen clean, tip run, loft clear-out; weekly **Water plants** series whose latest occurrence is *overdue*. |

The threads are visible through category filters, search (FULLTEXT) and consistent titles.

**Stats coverage designed in** (so every chart is populated): completions on ~25 distinct days (activity heat-map/productivity), completions spread across hours 07:00–22:00 (hourly chart), all 11 categories used (category volume, time-spent, distribution trend), overdue items aged ~1–33 days (overdue distribution buckets `<3d`, `1 week`, `1 month`, `3 months`), mix of early/late completions vs `end_at` (estimation accuracy, last 30 days), `created` 0–20 days before completion (turnaround), 20+ pending tasks in the next 14 days (week overview, deadline proximity, backlog health).

### 6.2 Fixture structure

```jsonc
{
  "fixture_version": 1,
  "timezone": "Europe/London",          // IANA tz used to turn wall-clock times into UTC
  "seed": 20260101,                      // RNG seed for deterministic jitter
  "user":  { "first_name": "...", "last_name": "...", "email": "..." },   // must equal DEMO_USER_EMAIL
  "tasks": [ <task>, ... ],              // standalone tasks and recurring masters
  "daily_brief": { "markdown": "..." }   // stored for date.today()
}
```

A **task** (all keys optional unless stated; keys starting with `_` are author comments and ignored):

| Key | Type | Maps to | Notes |
|---|---|---|---|
| `title` *(req)* | string ≤255 | `title` | |
| `description` | string | `description` | |
| `category` *(req)* | one of the 11 | `category` | |
| `start` *(req)* | time spec | `start_at` | see below |
| `mins` *(req)* | int > 0 | `end_at = start_at + mins` | guarantees `end > start` |
| `created` | time spec | `created_at` | required for non-history/non-master-with-history |
| `done` | time spec | `is_completed=1`, `completed_at` | omit ⇒ pending |
| `repeat` | `{ "by": daily\|weekly\|monthly\|yearly, "until": date-spec \| null }` | `is_repeating=1`, `repeat_by`, `repeat_until` | makes the row a **master** |
| `history` | see §6.3 | extra **history rows** | only allowed with `repeat` |

**Time specs** (wall-clock in `timezone`, converted to naive UTC; DST-safe via `zoneinfo`):

| Spec | Meaning |
|---|---|
| `D-3 09:00` / `D+2 14:30` | today ± n days |
| `W-1 wed 19:00` / `W+0 mon 10:00` | weekday of the ISO week (Mon–Sun) of today shifted by n weeks |
| `next thu 18:30` | first such weekday+time **strictly after now** |
| `next 07:00` | first such time of day strictly after now (daily series) |
| `next dom 1 09:00` | first day-of-month (1–28) strictly after now (monthly series) |

`repeat.until` is a **date spec** (time part omitted): `D+90`, `W-1 wed`, or `null`.

### 6.3 Recurring series generation (reproduces the app's own output)

A master's `start` is the **next occurrence not yet completed**. `history` describes occurrences that were completed *before* it:

```jsonc
"history": {
  "n": [1, 2, 4, 5],          // n-th period BEFORE the master start; missing n (here 3) = skipped, no row (matches skip behaviour)
  "done_after_min": 32,       // completion time = occurrence start + this ± jitter
  "jitter_min": 10,           // deterministic via random.Random(seed)
  "series_created": "D-40 18:00"
}
```

For each `n`, the seeder writes a Task identical to what `handle_repeat_task` would have produced:
`is_repeating=0, repeat_by=NULL, repeat_until=NULL, is_completed=1, series_id=<master id>`, `start_at/end_at = master − n periods` (using the **same arithmetic as `update_date`**: `timedelta` for daily/weekly, `relativedelta` for monthly/yearly), `completed_at` as above, and `created_at` = completion time of the next-older history row (or `series_created` for the oldest), because the app sets `created_at = now` on the master at each completion.

The **master** gets `series_id = own id`, `is_completed=0`, `completed_at=NULL` and `created_at` = completion time of history `n=min(n)` (or its own `created` if there is no history). If the master carries `done`, it represents a **finished series** (final occurrence completed, `repeat.until` = that date): then `is_completed=1` and `completed_at=done`.

Invariants checked at load time and by tests:
- Masters pending ⇒ `start` strictly in the future, **or** an explicit past `D-n` (deliberately overdue, e.g. "Water the plants").
- No stored row exists for a future occurrence (ghosts only).
- `repeat.until`, if set, ≥ master start date.
- Monthly/yearly masters should use day-of-month ≤ 28 (warn otherwise; `relativedelta` clamps but series would drift).

### 6.4 Full dataset

See **Appendix A** — a complete, copy-ready `demo_data.json` (67 standalone tasks + 8 recurring masters generating 38 history rows ≈ **113 task rows**, plus today's daily brief). Counts are *derived* by tests from the file, never hard-coded.

---

## 7. Seed / reset algorithm

CLI: `python -m app.demo.seed [--fixture PATH] [--now ISO8601] [--dry-run] --confirm-db NAME`

```
 1. Load fixture JSON.                                         (no DB)
 2. Validate (pure Python, fail fast; see list below).
 3. Resolve all time specs against now_utc (default: utcnow; --now overrides for tests)
    and the fixture timezone → concrete naive-UTC datetimes; expand histories with
    random.Random(seed). Produces an in-memory list of Task rows + brief.
 4. --dry-run: print a table of resolved rows and counts, exit 0.  (never opens a DB connection)
 5. Safety gate: --confirm-db must equal the connected database name
    (SELECT DATABASE()); print host/db before doing anything. Mismatch → exit 2.
 6. conn.get_lock: SELECT GET_LOCK('taskflow_demo_seed', 0) on the session's connection.
    0 → another reset is running → exit 3. (Released in `finally` — mandatory because the
    connection returns to the pool.)
 7. BEGIN (single transaction for everything below).
 8. SELECT * FROM users WHERE email = :demo_email FOR UPDATE.
      • not found           → INSERT user(is_demo=1, names from fixture, password_hash =
                              generate_password_hash(secrets.token_urlsafe(48)))   [hash discarded]
      • found, is_demo=1    → UPDATE first_name, last_name only (idempotent); keep id
      • found, is_demo=0    → ROLLBACK, exit 4: "refusing to touch a real account".
    demo_id := that row's id.   (FOR UPDATE also parks any concurrent demo-user INSERTs
    on the FK check until we commit, so a visitor's write cannot interleave mid-reset.)
 9. User-scoped deletes — every statement is built by one helper `scoped(model)` that always
    adds `WHERE model.user_id = :demo_id`; none touches users:
       DELETE notifications, notification_subscriptions, daily_briefs, password_resets,
              tasks                          WHERE user_id = :demo_id
       DELETE refresh_tokens WHERE user_id = :demo_id AND expires_at < :now   (live sessions kept)
10. INSERT tasks: masters + standalone first, session.flush() to obtain ids, then history rows
    with series_id = master.id; finally set series_id = id for masters/standalone
    (the only UPDATE; trigger-safe, see §1.1). All rows carry explicit created_at/completed_at.
11. INSERT daily_briefs(user_id, brief_text, generated_date = date.today())   ← same expression
    as ai_service.generate_daily_brief so the cache lookup hits.
12. Post-conditions (inside the txn; failure → ROLLBACK, exit 5):
       count(tasks WHERE user_id=:demo_id) == len(resolved rows)
       every completed row has completed_at not null and ≤ now
       every history row's series_id points at a row with is_repeating=1 and the same user_id
13. COMMIT.  RELEASE_LOCK in finally.  Print summary (deleted/inserted per table).
```

**Validation rules (step 2):** `fixture_version` supported; timezone valid; email equals `DEMO_USER_EMAIL`; unknown non-`_` keys rejected; category ∈ the 11; title ≤255; `mins > 0`; `repeat.by` ∈ enum; `history` only with `repeat`; `n` values are unique positive ints; `done ≥ start`-ish sanity (`done > created`); `completed_at ≤ now` (otherwise error — never silently produce a task "completed in the future"); pending master start in the future unless explicitly written as `D-n`; `repeat.until` ≥ start date; specs parse; resolved local times survive a UTC round-trip (rejects non-existent DST times).

**Why this is safe**
- *Atomic:* one InnoDB transaction ⇒ visitors see the old dataset until COMMIT, then the new one; any error rolls back to the previous demo state.
- *Scoped:* the only `user_id` ever used in a write is the id of the single row proven `is_demo=1 AND email=DEMO_USER_EMAIL`; real users are never read, joined or deleted (verified by test §11-3).
- *No dependency on cascade/FK config:* children are deleted by explicit `user_id`; `tasks.series_id` has no FK.
- *Idempotent:* run N times ⇒ identical content (ids differ; they auto-increment, which is harmless for INT range at ~113 rows × 4/day).
- *No external resources touched:* no files, no LLM calls, no email, no push. Web-push subscriptions for the demo user are deleted (and cannot be created, §8). The seeder never contacts Gemini/Groq/MailerSend.

---

## 8. Authentication flow and security

### 8.1 `POST /api/auth/demo`

1. Require header `X-Requested-With: XMLHttpRequest`, else `400`. (Forces a CORS preflight, so a third-party page cannot silently log a visitor into the demo with a form POST — "login CSRF"; credentials are not required for this endpoint, which is why existing `/login` doesn't need this.)
2. If the request already carries a **valid session for a non-demo user** (`verify_jwt_in_request(optional=True)` in a try/except — expired/invalid cookies are treated as "none") ⇒ `409 "Already signed in."` Never overwrite a real session.
3. `get_demo_user()` → `users WHERE is_demo=1 AND email=DEMO_USER_EMAIL`; none ⇒ `503 {"errors":{"general":"The demo is temporarily unavailable."}}`.
4. `create_access_token(identity=str(id), expires_delta=24h)` and `create_session(id, ttl=24h)` (shorter refresh lifetime than users' 7 days so demo refresh rows self-expire) and the existing `set_access_cookies` / `set_refresh_cookies`.
5. Respond with the **same shape as login**: `{"message": "...", "user": format_json_response(user)}` where `user` now includes `isDemo: true`.

`/api/auth/me` and `/api/auth/refresh` return `isDemo` too, so the banner survives reloads and token refresh without any new endpoint.

### 8.2 Controls

| Risk | Control |
|---|---|
| Logging into the demo account with a password / password reset | Random unusable hash; `.invalid` email; `login_user` rejects `is_demo`; `request_password_reset` skips demo; `reset-password` can't succeed without a token that is never created. |
| Impersonation via the demo endpoint | Endpoint accepts **no user id/email**; the target is fixed server-side by `is_demo AND email`. |
| `is_demo` forged | Not in any schema/validator/request path. |
| Real session clobbered | `/demo` route is `redirect={isAuthenticated}`; backend 409 (step 2). |
| Cross-visitor leakage / PII | Shared writable account ⇒ banner warns; fixture contains no real people, emails or phone numbers (review item). |
| AI cost / data bloat / endpoint abuse | **Accepted, per decision:** no new rate limits or quotas. Mitigations that come for free: the periodic reset wipes anything a visitor adds, and the daily brief is pre-seeded. |
| Push-subscription hijack | `subscribe` → `403` for demo; `NotificationsPrompt` hidden for demo. (Needed because `save_subscription` re-assigns an existing endpoint to whichever user posts it.) |
| Spam via contact form | Unchanged (already unauthenticated); out of scope. |
| Cookie settings | Reuse existing `JWT_COOKIE_SECURE` / SameSite logic untouched. |
| Observability | Log each demo login and each reset summary (no PII). |

---

## 9. Deployment steps (in order)

1. **Rehearse on a non-production MySQL** (docker-compose `db` or a staging DB). Never first-run the seeder against the production database from a laptop whose `.env` points at it — `--confirm-db` exists to stop that.
2. **Back up** the production DB.
3. **Deploy backend + frontend.** Container start now runs the fixed `init_db.py` (§5.1), which adds `users.is_demo` to the existing database. No manual `ALTER` is needed; confirm with `SHOW COLUMNS FROM users LIKE 'is_demo'`. Until step 5, "Try demo" shows the friendly 503 error.
4. **Dry run:** `python -m app.demo.seed --dry-run` — review the resolved table (no DB connection).
5. **Seed:** `python -m app.demo.seed --confirm-db "$DB_NAME"` (needs the column from step 3).
6. **Smoke test:** `curl -i -X POST -H 'X-Requested-With: XMLHttpRequest' …/api/auth/demo` → 200 + both cookies; then the manual QA list in §11.
7. **Schedule reset** every 6 hours at :05 (`5 */6 * * *` UTC; includes 00:05 so the new day's brief/anchor is fresh) with whatever scheduler you prefer, running on the same image: `python -m app.demo.seed --confirm-db "$DB_NAME"`. It needs only the DB env vars; no LLM or mail secrets.
8. Add the README "Live demo" link.

**Rollback:** revert the deploy (the frontend button disappears; the unused `is_demo` column is harmless). Remove the demo data entirely with a manual `DELETE FROM users WHERE is_demo = 1 AND email = 'demo@taskflow.invalid'` (children first if cascade isn't configured). Leaving the `is_demo` column in place is harmless.

---

## 10. Behaviour verification against the existing recurrence logic

The seeder must produce data that `with_repeating`, `check_should_repeat`, `handle_repeat_task` and the stats service treat correctly. Concretely (all covered by tests):

- **No duplicate ghost for the master itself:** `with_repeating` skips `task_start_at == instance_start`; seeded masters sit exactly at a period boundary.
- **No ghosts for history:** history rows have `is_repeating=0`, so only masters project.
- **Overdue recurring master** ("Water the plants", start = `D-1`): appears as one overdue row; ghosts begin one period later; completing it creates a history row and moves the master forward by exactly one period (still possibly in the past — that is the app's existing behaviour, not a seed bug).
- **Ended series** ("SQL course"): `repeat_until` = final occurrence date, master completed ⇒ `with_repeating` loop breaks immediately; no stray ghosts.
- **Pending ghosts in stats:** ghosts copy the master's `is_completed` (false) ⇒ they appear in "pending"/week-overview as designed; completed history rows feed productivity/turnaround/hourly charts.
- **Daily series:** master at `next 07:00` ⇒ never both a master and a ghost at the same instant.
- **Monthly/yearly:** day-of-month ≤ 28; yearly MOT is >30 days out (outside the stats ghost window) but visible in list/calendar-next-year.

---

## 11. Testing

Backend tests run against a **real MySQL test database** (FULLTEXT, `timestampdiff`, `GET_LOCK` and the trigger are MySQL-only). `conftest.py` **refuses to run unless `DB_NAME` ends in `_test`**, creates tables via `Base.metadata.create_all`, and installs the completion trigger SQL from `init_db.py`'s text.

**Fixture / pure-Python (no DB)**
1. Time-spec parser: `D`, `W`, `next …` forms; DST transitions (Europe/London spring/autumn); `next` strictly-after semantics at boundary instants.
2. Validator rejects: bad category, `mins<=0`, completed in the future, `history` without `repeat`, duplicate/zero `n`, pending master in the past without `D-n`, `until` < start, unknown keys, wrong email, bad tz.
3. History generator matches `update_date` stepping (daily/weekly/monthly/yearly) and the `created_at` chaining rule; deterministic for a fixed `seed` and `--now`.
4. The committed `demo_data.json` loads and resolves for a sweep of `--now` values (every hour across a DST week) with zero validation errors.

**DB integration**
1. Seeds an empty DB: demo user `is_demo=1`; counts equal those derived from the fixture; brief exists for `date.today()`.
2. **Idempotent:** run twice ⇒ same user id, same row count, same row content ignoring ids/auto-increment.
3. **Isolation (the key test):** create real users with tasks, briefs, notifications, subscriptions, refresh/reset tokens — including tasks whose titles equal fixture titles — snapshot all their rows, reset, assert the snapshot is byte-identical; also assert the SQL emitted by the seeder (via `before_cursor_execute`) never contains a `DELETE/UPDATE` without `user_id = :demo_id` (except the single `users` UPDATE keyed by the demo id).
4. Aborts with exit 4 when the demo email exists with `is_demo=0`; DB unchanged.
5. **Atomic:** monkeypatch an exception after the deletes ⇒ previous demo data fully intact.
6. **Lock:** second concurrent run exits 3.
7. Refresh tokens: unexpired demo token survives reset; expired removed.
8. **Recurrence behaviour:** for every master call `with_repeating` over `[now-35d, now+35d]` using real service code; assert expectations in §10; complete a seeded master through `update_task` and assert history row + advance; verify `get_all_dashboard_stats(demo_id)` succeeds and every chart is non-empty / overdue buckets populated.
9. Trigger safety: after seeding, no completed row has `completed_at IS NULL` and the `series_id` UPDATE leaves `completed_at` unchanged.

**API (Flask test client)**
1. `/api/auth/demo`: missing header → 400; unseeded → 503; success → 200, both cookies set, `/api/auth/me` → `isDemo: true`; with a real user's cookies → 409.
2. Password login with the demo email → 400 for any password; reset request returns the generic 200 but creates no token.
3. `subscribe` as demo → 403; as real user unchanged.
4. **Regression:** register/login/refresh/me still return the previous fields (+`isDemo: false`).

**Migration (against a throwaway MySQL, never production)**
1. Fresh database: `init_db.py` creates all tables including `users.is_demo`, the FULLTEXT index and the trigger.
2. Existing database created from the *old* schema (no `is_demo`): `init_db.py` adds the column; existing users have `is_demo = 0`.
3. Run `init_db.py` twice more: no error, nothing duplicated, and the trigger/backfill steps still run (they were previously skipped after the FULLTEXT failure).
4. Container: `docker build` + run shows `init_db.py` executing from `start.sh` before gunicorn.

**Frontend** (no test runner exists; adding one is out of scope): `npm run lint && npm run build` must pass, plus manual QA: Try demo from Login, Register, nav and a direct `/demo` visit; refresh the page (session + banner persist); tour Tasks (filters, search "aws", pagination), Calendar (ghost tasks for Team sync / Morning run), Stats (all charts), Daily Brief card, Pomodoro on a task, Break-it-down page, Settings export; **Exit demo** returns to register; a signed-in real user visiting `/demo` is redirected to `/` and not switched; push prompt never shows in demo; mobile width.

---

## 12. Unresolved questions

Resolved by review: projects/priority (dropped), AI rate limiting (none), `run_reminders` (untouched), shared writable account, no feature flags, make migrations work.

Remaining items are defaults I will use unless told otherwise:

1. **Persona/timezone:** Alex Taylor, software engineer, `Europe/London`.
2. **Demo session lifetime:** 24 h refresh token (users keep 7 days); access token unchanged at 24 h.
3. **Reset schedule:** every 6 h at :05 UTC, run by whatever scheduler you choose (not tied to `run_reminders`).
4. **Rehearsal/test database:** the seeder and tests refuse to run unless the target DB is explicitly confirmed (`--confirm-db`, test DB name ending in `_test`). I need a throwaway MySQL (e.g. the `docker-compose` `db` service) to rehearse; I won't run anything against the database in your local `.env`.
5. **`init_db.py` TLS:** it keeps requiring `ca.pem`/TLS as today, so running it against a plain local MySQL still needs that to be handled by you; I'm not changing connection behaviour.
6. **Email/name:** `demo@taskflow.invalid`.

---

## Appendix A — `app/demo/fixtures/demo_data.json` (proposed content)

Notes: `D±n` offsets are relative to today; every completed task finishes on `D-1` or earlier, so nothing is ever "completed in the future". Threads are described in §6.1.

```json
{
  "fixture_version": 1,
  "timezone": "Europe/London",
  "seed": 20260101,
  "user": { "first_name": "Alex", "last_name": "Taylor", "email": "demo@taskflow.invalid" },
  "tasks": [
    { "_section": "COMPLETED (past four weeks)" },
    { "title": "Review pull request: auth refactor", "description": "Check token rotation and the cookie settings.", "category": "work", "start": "D-27 10:00", "mins": 45, "created": "D-28 16:00", "done": "D-27 10:35" },
    { "title": "AWS Cloud Practitioner: IAM module", "description": "Notes plus ten practice questions.", "category": "learning", "start": "D-26 19:00", "mins": 60, "created": "D-30 21:00", "done": "D-26 19:50" },
    { "title": "Submit monthly expenses", "description": "Receipts for travel and the team lunch.", "category": "finance", "start": "D-25 12:30", "mins": 30, "created": "D-26 09:00", "done": "D-25 12:52" },
    { "title": "Dentist check-up", "description": "Six-month check and hygienist.", "category": "health", "start": "D-24 08:30", "mins": 45, "created": "D-45 18:00", "done": "D-24 09:20" },
    { "title": "Write API docs for task endpoints", "description": "Cover filters, pagination and repeat rules.", "category": "work", "start": "D-23 14:00", "mins": 120, "created": "D-26 10:00", "done": "D-23 16:25" },
    { "title": "Assemble the new bookshelf", "category": "home", "start": "D-22 10:00", "mins": 90, "created": "D-24 20:00", "done": "D-22 11:40" },
    { "title": "Dinner for Maya's birthday", "description": "Table booked for six.", "category": "social", "start": "D-21 19:30", "mins": 120, "created": "D-33 12:00", "done": "D-21 21:45" },
    { "title": "Edit holiday photos", "description": "Pick the best twenty for the album.", "category": "hobbies", "start": "D-20 20:00", "mins": 90, "created": "D-27 22:00", "done": "D-20 21:25" },
    { "title": "Renew car insurance", "description": "Compare three quotes first.", "category": "life-admin", "start": "D-19 11:00", "mins": 45, "created": "D-34 09:00", "done": "D-19 11:35" },
    { "title": "Fix flaky CI test suite", "description": "Quarantine the two unstable integration tests.", "category": "work", "start": "D-18 09:30", "mins": 180, "created": "D-19 17:00", "done": "D-18 12:40" },
    { "title": "AWS: S3 and storage labs", "category": "learning", "start": "D-17 19:00", "mins": 60, "created": "D-22 20:00", "done": "D-17 20:10" },
    { "title": "Deep clean the kitchen", "category": "chores", "start": "D-16 10:00", "mins": 90, "created": "D-17 08:00", "done": "D-16 11:20" },
    { "title": "Parkrun: first 5k attempt", "description": "Aim for under thirty minutes.", "category": "health", "start": "D-15 09:00", "mins": 45, "created": "D-29 19:00", "done": "D-15 09:48" },
    { "title": "Quarterly planning workshop", "description": "Bring the capacity estimates.", "category": "work", "start": "D-14 13:00", "mins": 150, "created": "D-21 11:00", "done": "D-14 15:30" },
    { "title": "Build a monthly budget spreadsheet", "category": "finance", "start": "D-13 20:00", "mins": 60, "created": "D-14 21:00", "done": "D-13 21:15" },
    { "title": "Book a massage", "category": "self-care", "start": "D-12 18:00", "mins": 15, "created": "D-12 12:00", "done": "D-12 18:12" },
    { "title": "Back up laptop and phone", "category": "general", "start": "D-12 21:00", "mins": 30, "created": "D-18 19:00", "done": "D-12 21:35" },
    { "title": "Prototype dashboard filters", "description": "Date range and category chips.", "category": "work", "start": "D-11 10:00", "mins": 240, "created": "D-14 09:30", "done": "D-11 14:45" },
    { "title": "Fix the leaking bathroom tap", "category": "home", "start": "D-10 16:00", "mins": 45, "created": "D-15 19:30", "done": "D-10 16:50" },
    { "title": "AWS: VPC networking lab", "category": "learning", "start": "D-9 19:00", "mins": 90, "created": "D-13 20:00", "done": "D-9 20:40" },
    { "title": "Catch-up call with Gran", "category": "social", "start": "D-8 18:30", "mins": 30, "created": "D-9 09:00", "done": "D-8 18:58" },
    { "title": "Sprint review demo for the client", "category": "work", "start": "D-7 15:00", "mins": 60, "created": "D-12 10:00", "done": "D-7 16:05" },
    { "title": "Learn a new song on guitar", "description": "Chords and strumming pattern.", "category": "hobbies", "start": "D-6 20:00", "mins": 45, "created": "D-10 21:00", "done": "D-6 20:50" },
    { "title": "Get passport photos taken", "category": "life-admin", "start": "D-5 12:00", "mins": 30, "created": "D-8 08:30", "done": "D-5 12:25" },
    { "title": "Draft release notes for v2.3", "category": "work", "start": "D-4 11:00", "mins": 60, "created": "D-6 16:00", "done": "D-4 11:55" },
    { "title": "Take recycling to the tip", "category": "chores", "start": "D-3 10:00", "mins": 45, "created": "D-5 18:00", "done": "D-3 10:55" },
    { "title": "Pay off the credit card", "category": "finance", "start": "D-2 09:00", "mins": 15, "created": "D-3 20:00", "done": "D-2 09:05" },
    { "title": "Sprint retro: collect feedback", "category": "work", "start": "D-1 14:00", "mins": 45, "created": "D-4 15:00", "done": "D-1 14:40" },
    { "title": "Evening walk and podcast", "category": "self-care", "start": "D-1 18:00", "mins": 40, "created": "D-1 12:00", "done": "D-1 18:45" },
    { "title": "AWS practice exam 1", "description": "Timed, no notes.", "category": "learning", "start": "D-1 19:30", "mins": 90, "created": "D-6 20:00", "done": "D-1 21:15" },

    { "_section": "OVERDUE (pending, end in the past; ages ~1 day to ~5 weeks)" },
    { "title": "Refactor notification service tests", "description": "Split fixtures and remove the sleeps.", "category": "work", "start": "D-1 16:00", "mins": 120, "created": "D-6 10:00" },
    { "title": "Order a replacement boiler filter", "category": "home", "start": "D-2 12:00", "mins": 20, "created": "D-8 19:00" },
    { "title": "Reply to the council tax letter", "category": "life-admin", "start": "D-5 10:00", "mins": 30, "created": "D-12 08:00" },
    { "title": "Send thank-you notes for birthday gifts", "category": "social", "start": "D-9 17:00", "mins": 30, "created": "D-14 20:00" },
    { "title": "Cancel the unused streaming subscription", "category": "finance", "start": "D-14 09:00", "mins": 15, "created": "D-20 22:00" },
    { "title": "Sort photo library into albums", "category": "hobbies", "start": "D-22 10:00", "mins": 120, "created": "D-30 20:00" },
    { "title": "Read chapter 3 of the distributed systems book", "category": "learning", "start": "D-33 20:00", "mins": 60, "created": "D-40 21:00" },

    { "_section": "TODAY (pending)" },
    { "title": "Finish onboarding flow PR", "description": "Handle the empty state and add tests.", "category": "work", "start": "D+0 09:30", "mins": 120, "created": "D-3 14:00" },
    { "title": "Review pension contributions", "category": "finance", "start": "D+0 12:30", "mins": 30, "created": "D-14 20:00" },
    { "title": "Review Q4 roadmap with Sam", "description": "Agree what slips to Q1.", "category": "work", "start": "D+0 14:00", "mins": 60, "created": "D-6 11:00" },
    { "title": "Collect the click-and-collect grocery order", "category": "chores", "start": "D+0 17:15", "mins": 30, "created": "D-1 20:30" },
    { "title": "AWS: RDS and databases module", "category": "learning", "start": "D+0 18:00", "mins": 60, "created": "D-10 21:00" },
    { "title": "Pub quiz with the team", "category": "social", "start": "D+0 20:15", "mins": 120, "created": "D-8 13:00" },

    { "_section": "UPCOMING (next two weeks) — Lisbon thread: parent + five siblings created together, as 'Break it down' + bulk create does" },
    { "title": "Plan a long weekend in Lisbon", "description": "Flights, a place to stay and a loose itinerary.", "category": "life-admin", "start": "D+7 19:00", "mins": 60, "created": "D-3 21:00" },
    { "title": "Compare flights and book", "category": "life-admin", "start": "D+1 20:00", "mins": 45, "created": "D-1 21:05" },
    { "title": "Shortlist neighbourhoods and book accommodation", "category": "life-admin", "start": "D+2 20:00", "mins": 60, "created": "D-1 21:05" },
    { "title": "Draft a day-by-day itinerary", "category": "general", "start": "D+4 19:30", "mins": 60, "created": "D-1 21:05" },
    { "title": "Book a restaurant for the Saturday night", "category": "social", "start": "D+5 12:00", "mins": 15, "created": "D-1 21:05" },
    { "title": "Sort travel insurance and currency", "category": "finance", "start": "D+6 18:00", "mins": 30, "created": "D-1 21:05" },
    { "title": "Post the passport renewal", "category": "life-admin", "start": "D+3 12:00", "mins": 30, "created": "D-2 10:00" },

    { "title": "AWS: IAM and security flash cards", "category": "learning", "start": "D+1 07:45", "mins": 30, "created": "D-2 21:00" },
    { "title": "Prepare sprint demo slides", "category": "work", "start": "D+2 10:00", "mins": 90, "created": "D-1 09:00" },
    { "title": "Frontend interview panel", "description": "Two 45-minute interviews and a debrief.", "category": "work", "start": "D+3 14:00", "mins": 120, "created": "D-5 10:00" },
    { "title": "Write performance review self-assessment", "category": "work", "start": "D+6 13:00", "mins": 120, "created": "D-4 12:00" },
    { "title": "Ship the v2.4 release", "description": "Final QA, changelog and rollout.", "category": "work", "start": "D+9 11:00", "mins": 120, "created": "D-8 16:00" },
    { "title": "Lightning talk: React Query patterns", "category": "work", "start": "D+12 16:00", "mins": 60, "created": "D-9 09:30" },
    { "title": "AWS Cloud Practitioner exam", "description": "Bring ID and arrive fifteen minutes early.", "category": "learning", "start": "D+13 10:00", "mins": 90, "created": "D-40 20:00" },
    { "title": "Annual blood test at the GP", "category": "health", "start": "D+4 08:15", "mins": 30, "created": "D-7 12:00" },
    { "title": "Flu jab at the pharmacy", "category": "health", "start": "D+7 09:00", "mins": 15, "created": "D-10 11:00" },
    { "title": "Gather receipts for the tax return", "category": "finance", "start": "D+8 19:00", "mins": 60, "created": "D-12 20:00" },
    { "title": "Book the annual boiler service", "category": "home", "start": "D+2 12:15", "mins": 15, "created": "D-3 19:00" },
    { "title": "Clear out the loft", "category": "chores", "start": "D+5 10:00", "mins": 180, "created": "D-11 18:00" },
    { "title": "Housewarming at Priya's", "category": "social", "start": "D+6 19:00", "mins": 180, "created": "D-13 14:00" },
    { "title": "Spa afternoon", "category": "self-care", "start": "D+8 14:00", "mins": 120, "created": "D-5 18:00" },
    { "title": "Pick up dry cleaning", "category": "general", "start": "D+1 17:45", "mins": 15, "created": "D-1 08:00" },
    { "title": "Print and frame a holiday photo", "category": "hobbies", "start": "D+10 18:00", "mins": 30, "created": "D-18 20:30" },
    { "title": "Mum's birthday dinner", "category": "social", "start": "D+11 19:00", "mins": 150, "created": "D-16 19:00" },

    { "_section": "RECURRING MASTERS (history rows are generated; see §6.3)" },
    { "title": "Team sync", "description": "Weekly priorities and blockers.", "category": "work",
      "start": "next mon 10:00", "mins": 30, "repeat": { "by": "weekly", "until": null },
      "history": { "n": [1, 2, 4, 5], "done_after_min": 32, "jitter_min": 8, "series_created": "D-60 09:00" } },
    { "title": "Morning run", "description": "Easy 5k pace, no pressure.", "category": "health",
      "start": "next 07:00", "mins": 35, "repeat": { "by": "daily", "until": null },
      "history": { "n": [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21], "done_after_min": 38, "jitter_min": 6, "series_created": "D-40 21:00" } },
    { "title": "Guitar lesson", "category": "hobbies",
      "start": "next thu 18:30", "mins": 45, "repeat": { "by": "weekly", "until": null },
      "history": { "n": [1, 2, 3, 4], "done_after_min": 50, "jitter_min": 5, "series_created": "D-45 19:00" } },
    { "title": "Water the plants and tidy the desk", "category": "chores",
      "_note": "Deliberately overdue: the latest occurrence was missed.",
      "start": "D-1 09:30", "mins": 20, "repeat": { "by": "weekly", "until": null },
      "history": { "n": [1, 2, 3], "done_after_min": 25, "jitter_min": 10, "series_created": "D-35 10:00" } },
    { "title": "Pay rent", "description": "Check the standing order went out.", "category": "finance",
      "start": "next dom 1 09:00", "mins": 15, "repeat": { "by": "monthly", "until": null },
      "history": { "n": [1, 2], "done_after_min": 10, "jitter_min": 3, "series_created": "D-90 09:00" } },
    { "title": "Weekly review and plan next week", "category": "general",
      "start": "next sun 18:00", "mins": 30, "repeat": { "by": "weekly", "until": null },
      "history": { "n": [1, 2, 3], "done_after_min": 30, "jitter_min": 8, "series_created": "D-30 18:00" } },
    { "title": "Car MOT", "description": "Book the garage a month ahead.", "category": "life-admin",
      "start": "D+27 09:00", "mins": 90, "created": "D-60 18:00", "repeat": { "by": "yearly", "until": null } },
    { "title": "SQL performance course session", "description": "Final session: indexing and query plans.", "category": "learning",
      "_note": "Ended series: final occurrence completed, repeat_until = that date.",
      "start": "W-1 wed 19:00", "mins": 60, "done": "W-1 wed 20:05",
      "repeat": { "by": "weekly", "until": "W-1 wed" },
      "history": { "n": [1, 2, 3, 4, 5], "done_after_min": 62, "jitter_min": 6, "series_created": "D-50 20:00" } }
  ],
  "daily_brief": {
    "markdown": "### Vibe check\nYou're in good shape, Alex. Yesterday's retro and your first AWS practice exam are both done, and the morning run streak is holding.\n\n### The main event\n**Finish onboarding flow PR** at 09:30 is today's priority, closely followed by the **Q4 roadmap review with Sam** at 14:00.\n\n### Overdue\nA few older items are lingering. Start with **Refactor notification service tests**: it's the freshest and it unblocks the release.\n\n### Workload\nToday is a little heavier than your usual rhythm, so protect the morning for deep work and keep the evening gentle with the **AWS RDS module** before the pub quiz. Onwards!"
  }
}
```

Loader notes for Appendix A: objects containing only `_section` are skipped; the brief uses only `###`, paragraphs and `**bold**` because `DailyBrief.tsx` renders with `allowedElements={["h1","h2","h3","h4","p","strong"]}` (lists/emphasis would be dropped).
