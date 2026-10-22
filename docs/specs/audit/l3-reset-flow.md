# L3: Password-reset and login polish

> **Severity:** Low · **Category:** Security / robustness · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** [H3](h3-hardcoded-db-default.md) (`FRONTEND_URL` required), [M6](m6-token-hardening.md) (same service), [M2](m2-error-handling.md), [H4](h4-redis-rate-limiting.md).

## 1. Context and evidence

`task-manager-backend/app/routes/auth_routes.py`:
- `:236-258` `request_password_reset`: for an existing, non-demo user it creates a token and sends mail **inside the same `try`** whose handler returns `500` with `str(e)`. If MailerSend fails, existing accounts get a 500 while unknown addresses get a 200: account existence leaks, and the exception text is exposed.
- `:238` builds `f"{os.getenv('FRONTEND_URL')}/reset-password?token=…"`; with the variable unset the link starts with `None`.
- `app/services/auth_service.py:43-50` `login_user` calls `check_password_hash` only when the user exists → measurable timing difference (user enumeration).
- `app/utils/validators.py:205-210,221-232` password policy: 8-50 characters with a letter and a digit; no common-password check. `validate_password` returns `None` implicitly on success.
- Passwords are `.strip()`ped on register/login/reset (`auth_routes.py:85,132`).

## 2. Goals and non-goals

**Goals**
- Uniform response regardless of account existence; failures logged not leaked.
- Equalised login timing.
- Stop the most common passwords.

**Non-goals**
- Breached-password API checks, MFA, changing the length/complexity rules, **removing the `.strip()`** (kept for compatibility, see below).

## 3. Design

1. **Reset request:** compute everything, then send mail in its own `try/except`; on any exception log (provider name, exception class) and continue; **always** return `200 {"message": "If an account exists, a reset link has been sent."}`. Do the work in a small `send_reset_email(user, token)` function so a later move to a background task is trivial.
2. **Config:** `FRONTEND_URL` is required at startup ([H3](h3-hardcoded-db-default.md)); strip a trailing slash when building the link.
3. **Timing:** a module constant `DUMMY_HASH = generate_password_hash("not-a-real-password")`; when the email is unknown (or the account is demo) run `check_password_hash(DUMMY_HASH, password)` and return `None`.
4. **Common passwords:** `app/utils/common_passwords.txt` (about 100 of the most common entries that satisfy the existing rules, for example variants like `password1`, `qwerty123`), loaded once into a set; `validate_password` and `validate_user` reject case-insensitive matches with a clear message. Make `validate_password` return `None` explicitly.
5. **`.strip()` is kept** on purpose: accounts created so far stored stripped passwords, so removing it would lock out users whose password was typed with trailing spaces. Add a code comment saying so.
6. **Frontend:** `RequestPasswordReset` already shows a generic message; add the 429 message from [H4](h4-redis-rate-limiting.md).

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Response bodies and status codes are identical for existing, unknown and demo accounts.
- Timing parity is best-effort (hashing cost dominates); email sending time can still differ; moving mail to a background thread/queue is optional later.

## 6. Test plan

- Mailer raising → 200 for an existing account, error logged, no body leakage.
- Unknown email, demo email, existing email → identical status and body.
- `check_password_hash` is called for an unknown email (patch and assert).
- `password1`/`Qwerty123` rejected on register and reset; a strong password accepted.
- Reset link uses `FRONTEND_URL` without a double slash.

## 7. Verification

Disable the mailer API key in staging and request a reset: UI shows the generic message, logs show the failure.

## 8. Dependencies

- [H3](h3-hardcoded-db-default.md), [M6](m6-token-hardening.md), [M2](m2-error-handling.md), [H4](h4-redis-rate-limiting.md).

## 9. Open questions and user-only actions

- None.
