# M6: Revoke sessions on password reset; hash stored tokens

> **Severity:** Medium · **Category:** Security · **Effort:** Small to Medium · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** ships in one change set with [M5](m5-session-table-purge.md) and the backend half of [H2](h2-refresh-race.md).

## 1. Context and evidence

- `task-manager-backend/app/services/auth_service.py:97-108` (`update_password_and_clear_token`) changes the password but leaves all of the user's `refresh_tokens` in place.
- `auth_service.py:74-83`: the reset token is stored raw in `password_resets.token`. `:137-145`: refresh tokens are stored raw in `refresh_tokens.token`.
- Logout cannot revoke the 24 h access JWT (stateless).

**Impact:** an attacker holding a stolen session stays signed in for up to 7 days after the victim resets the password; a database read leak exposes directly usable reset and refresh tokens (reset valid 15 minutes).

## 2. Goals and non-goals

**Goals**
- A password reset ends every existing refresh session for that user.
- A DB leak does not directly yield usable tokens.
- Existing sessions and pending reset links keep working through the deploy.

**Non-goals**
- Access-token revocation (`token_version` claim). Noted as a possible later step; not planned.
- Changing token lifetimes.

## 3. Design

### 3.1 Hashing
- `_hash(token) = hashlib.sha256(token.encode()).hexdigest()` (64 lowercase hex chars).
- Schema: `refresh_tokens.token_hash CHAR(64)` and `password_resets.token_hash CHAR(64)`.
- New rows write **only** `token_hash`; the plaintext `token` columns become `NULL`-able and are no longer written.
- Lookups (`validate_refresh_token`, `delete_refresh_token`, `verify_reset_token`, `update_password_and_clear_token`) hash the presented value first.
- Cookies and email links still carry the plaintext random token; only storage changes.

### 3.2 Migration steps (`init_db.py`, idempotent)
1. `add_token_hash_columns`: add both columns if missing.
2. `backfill_token_hashes`: `UPDATE refresh_tokens SET token_hash = SHA2(token, 256) WHERE token_hash IS NULL AND token IS NOT NULL` (same for `password_resets`). MySQL `SHA2(…,256)` equals the Python hex digest, so existing sessions continue to work.
3. `relax_plaintext_token_columns`: `MODIFY token VARCHAR(255) NULL` on both tables.
4. Unique index creation is part of [M5](m5-session-table-purge.md).
5. **Follow-up (separate, later release):** `UPDATE … SET token = NULL` and drop the plaintext columns once all instances run the new code.

Update the SQLAlchemy models accordingly (`token_hash` mapped; `token` kept nullable until the follow-up).

### 3.3 Revoke on reset
In `update_password_and_clear_token`, inside the same transaction: delete **all** `RefreshToken` rows for `user_id`, delete the used reset row(s), set the new password hash, commit once.

### 3.4 Deleting reset tokens
`create_reset_token` already deletes previous reset rows for the user; keep that, now keyed by `user_id`.

## 4. Data and migration

See 3.2. Deploy order: run migrations (steps 1-3) before the new code serves traffic; the new code can read pre-backfill rows only because step 2 runs first, so keep `start.sh` ordering (`init_db.py` then gunicorn) strict ([M11](m11-deployment-hardening.md) makes failures fatal).

## 5. Security and failure behaviour

- Constant-time comparison is not needed for hash lookups through an indexed equality query.
- If the hashing migration is partially applied, rows with `token_hash IS NULL` are treated as invalid rather than falling back to plaintext lookups.

## 6. Test plan

- Password reset invalidates an existing refresh token (refresh returns 401 afterwards) and deletes the reset row.
- Stored value in the DB is the SHA-256 of the cookie value, not the cookie value.
- Migration backfill: pre-existing plaintext row becomes valid via hash lookup; running the migration twice is a no-op.
- Reset token single use; expired reset token rejected.

## 7. Verification

In staging: log in on two browsers, reset the password via the emailed link, confirm both browsers are signed out on next refresh.

## 8. Dependencies

- [M5](m5-session-table-purge.md), [H2](h2-refresh-race.md), [L3](l3-reset-flow.md) (same area), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- Decide when to run the follow-up that nulls and drops the plaintext columns (suggest one release after this).
