# H2: Concurrent refreshes log users out

> **Severity:** High · **Category:** Bug / reliability · **Effort:** Small (frontend) + Small (backend, shipped inside [M5/M6](m5-session-table-purge.md)) · **Status:** Specified, not implemented
> **Finding status:** Confirmed by code trace.
> **Depends on:** [H1](h1-logged-out-redirect.md) (same interceptor), [M5](m5-session-table-purge.md)/[M6](m6-token-hardening.md) (migration batch that adds `replaced_at` and token hashes).

## 1. Context and evidence

- `task-manager-frontend/src/services/api.ts:28-32`: every failed request independently calls `POST /auth/refresh`.
- `task-manager-backend/app/services/auth_service.py:148-150`: `rotate_refresh_token` deletes the old token then creates a new one. `validate_refresh_token` (`:111-121`) only accepts a token that still exists.
- `app/routes/auth_routes.py:289-314`: `/auth/refresh` validates, issues an access token, rotates.

When the 24 h access JWT expires and a page fires several queries at once (tasks, notifications, brief, stats), each gets a 401 and each calls refresh with the same cookie. The first rotates; the rest present a deleted token, get 401, and the interceptor treats that as session loss.

**Impact:** intermittent forced logouts after the access token expires.

## 2. Goals and non-goals

**Goals**
- Any number of parallel 401s result in exactly one refresh round trip from the client.
- A server-side grace window tolerates a stale refresh token presented within seconds of rotation (second tab, retry after a network blip).

**Non-goals**
- Refresh-token reuse *detection* with family revocation (possible later; not required now).
- Changing token lifetimes (7 days, demo 24 h).

## 3. Design

### Frontend (`src/services/api.ts`)

- Module-level `let refreshPromise: Promise<unknown> | null = null`.
- On a qualifying 401 (see H1 exclusions): `refreshPromise ??= apiClient.post("/auth/refresh").finally(() => { refreshPromise = null; })`; `await refreshPromise`; retry the original request once (`_retry`).
- If the refresh rejects, every waiting request rejects; the session-expired handler (H1) fires once.

### Backend

1. **Schema:** `refresh_tokens.replaced_at DATETIME NULL` (migration in M5/M6 batch).
2. **Rotation:** `rotate_refresh_token(old_token_hash, user_id)` sets `replaced_at = UTC_NOW` on the old row and inserts the new one (in one transaction). It no longer deletes the old row.
3. **Validation:** a token is valid if `expires_at > now` and either `replaced_at IS NULL` or `replaced_at > now - GRACE` where `GRACE = 10 seconds` (constant in `auth_service.py`).
4. **Route behaviour:** if the presented token was *already replaced* (inside grace), `/auth/refresh` returns a fresh access token and user payload but **does not** issue or set a new refresh cookie (the browser already received one from the first response). If the token is unreplaced, behave as today (rotate and set both cookies).
5. **Cleanup:** replaced rows older than the grace window are removed by the opportunistic purge in [M5](m5-session-table-purge.md).
6. Logout deletes the presented token's row and any rows replaced from it.

## 4. Data and migration

Idempotent `init_db.py` step `add_refresh_tokens_replaced_at` using `column_exists`. No backfill needed (null means unreplaced).

## 5. Security and failure behaviour

- Grace is short (10 s) and limited to tokens that were legitimately rotated; a token replayed after the window is rejected.
- A graced request cannot extend the session by minting a second refresh token.
- If the DB is unavailable during refresh, return 503 (not 401) so the client does not interpret it as session loss. Handle in the refresh route / [M2](m2-error-handling.md) handler.

## 6. Test plan

Backend (pytest):
- Two concurrent refreshes with the same cookie both return 200; exactly one sets a refresh cookie.
- The same old token after > 10 s returns 401.
- A token past `expires_at` returns 401.
- Logout invalidates the active token.

Frontend (Vitest): three simultaneous 401s produce one `/auth/refresh` call and three successful retries; a failed refresh rejects all three and calls the handler once.

## 7. Verification

Local: shorten the access-token lifetime to 30 s via env/config in a dev run, open Home, wait 35 s, reload; confirm no redirect and a single refresh in the network panel.

## 8. Dependencies

- [H1](h1-logged-out-redirect.md), [M5](m5-session-table-purge.md), [M6](m6-token-hardening.md), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- None. Grace length (10 s) is a default; adjust if you see slow networks.
