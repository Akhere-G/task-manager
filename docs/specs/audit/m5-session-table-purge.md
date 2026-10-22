# M5: Session table growth, missing index, opportunistic purge

> **Severity:** Medium · **Category:** Performance / reliability · **Effort:** Small · **Status:** Specified, not implemented
> **Decisions recorded:** expired tokens are deleted **opportunistically on login**; **demo functionality is left as is** (no change to `demo_login`, demo TTL or demo session creation).
> **Finding status:** Confirmed.
> **Depends on:** none to start; ships in the same migration batch as [M6](m6-token-hardening.md) and the backend half of [H2](h2-refresh-race.md).

## 1. Context and evidence

- `task-manager-backend/init_db.py:113-120`: `refresh_tokens` has **no index on `token`** (only the FK index on `user_id`). The model (`app/models/users.py:34`) says `unique=True`, but `init_db.py` is what creates the table.
- `app/services/auth_service.py:111-126` look up by `token`; `:137-145` insert a row for every login, register, refresh and demo login.
- Nothing deletes expired rows (`password_resets` either).
- `POST /api/auth/demo` is unauthenticated and creates a row each call.

**Impact:** each refresh and logout is a full table scan; the table grows indefinitely.

## 2. Goals and non-goals

**Goals**
- Indexed token lookups.
- Expired data removed without a scheduler.

**Non-goals**
- Any change to demo behaviour (explicit decision).
- A dedicated cron/Cloud Scheduler cleanup job (can be added later).

## 3. Design

### 3.1 Indexes (idempotent steps in `init_db.py`)
- Unique index on `refresh_tokens.token_hash` (column introduced in [M6](m6-token-hardening.md)); created in the same step after the backfill.
- Index on `refresh_tokens.expires_at`, and on `password_resets.expires_at`.
- Use the existing `index_exists` helper; each step is its own `run_step` so one failure does not skip others (and, per [M11](m11-deployment-hardening.md), a failure here is fatal).

### 3.2 Purge on login
New `purge_expired_sessions(user_id)` in `auth_service.py`, called from the `login` route **after** a successful `login_user` and before creating the new session:

1. Delete that user's expired rows: `DELETE FROM refresh_tokens WHERE user_id = :uid AND expires_at < UTC_NOW`.
2. Bounded global batch: `DELETE FROM refresh_tokens WHERE expires_at < UTC_NOW OR replaced_at < UTC_NOW - INTERVAL 1 MINUTE LIMIT 500` (the `replaced_at` clause cleans rows left by H2's rotation grace).
3. `DELETE FROM password_resets WHERE expires_at < UTC_NOW LIMIT 500`.
4. Commit once. Wrap in `try/except` that logs and continues: purge failure must never block login.

Because real logins trigger the global batch, accumulated demo rows are also cleaned over time without touching demo code.

## 4. Data and migration

Steps: `add_refresh_token_indexes` (after M6 backfill). Existing duplicate tokens are impossible (random 64-byte tokens), but the step should log and skip the unique index if duplicate hashes are found.

## 5. Security and failure behaviour

- Purge uses UTC consistently with how `expires_at` is written (`datetime.now(timezone.utc)`).
- Purge deletes only rows that are already invalid; no valid session is affected.

## 6. Test plan

- Insert expired and valid rows for two users and some demo rows; log in as user A: A's expired rows are gone, valid rows remain, a batch of other expired rows is removed, user B's valid row remains.
- Demo login still works and its rows still get the demo TTL (assert TTL = 24 h, unchanged).
- Purge exception (patch to raise) does not break login.
- `EXPLAIN` on the lookup query uses the unique index (assert via `information_schema`/EXPLAIN in the MySQL test DB).

## 7. Verification

Check row counts before/after logins in staging; confirm query time on `refresh_tokens` lookups with a few hundred thousand synthetic rows.

## 8. Dependencies

- [M6](m6-token-hardening.md) (hash column), [H2](h2-refresh-race.md) (`replaced_at`), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

None.
