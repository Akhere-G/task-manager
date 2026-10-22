# L1: Cookie hardening and CSRF defence

> **Severity:** Low · **Category:** Security (defence in depth) / bug · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Potential for CSRF (mitigated today, see below); the cookie-lifetime and fail-open items are confirmed.
> **Depends on:** [H1](h1-logged-out-redirect.md)/[H2](h2-refresh-race.md) (frontend client), [H4](h4-redis-rate-limiting.md) (ProxyFix/limiter order), [M12](m12-tests-and-ci.md).

## 1. Context and evidence

- `task-manager-backend/app/main.py:47` `JWT_COOKIE_CSRF_PROTECT = False`; `:51-54` uses `SameSite=None` whenever `JWT_COOKIE_SECURE` is true.
- `main.py:49` `JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE") == "True"`: if the variable is missing, cookies are **not** Secure (fails open).
- `app/routes/auth_routes.py:32-53` set cookies by hand with no `max_age`/`expires`, so both cookies are **session cookies**: the advertised 7-day login is lost when the browser closes. `:205` deletes `refresh_token` with different attributes than it was set with.
- Current mitigation: Flask rejects non-JSON bodies on `request.json` routes, and `PATCH`/`DELETE` need a CORS preflight against a single allowed origin. Residual exposure is bodiless `POST`s (`/auth/logout`, `/auth/refresh`, `/auth/demo`) from another site while `SameSite=None`.
- Production serves SPA and API from **one origin** (root `Dockerfile`), where `SameSite=Lax` is sufficient.

## 2. Goals and non-goals

**Goals**
- Secure by default; cookies persist as intended; cross-site state changes blocked without a token flow.

**Non-goals**
- Full double-submit CSRF tokens; moving tokens out of cookies.

## 3. Design

1. **Config** (`app/config.py`): `JWT_COOKIE_SECURE` defaults to **true**; only the literal `False` disables it (local `.env` already sets `False`). `JWT_COOKIE_SAMESITE` env, default `Lax`; README documents that a split-origin deployment (SPA on another site, for example Vercel) must set `None`.
2. **One helper** `set_auth_cookies(response, access_token, refresh_token=None, refresh_ttl=…)` and `clear_auth_cookies(response)` in `app/utils/cookies.py`, replacing `set_access_cookies`/`set_refresh_cookies` and the inline `set_cookie` calls. Attributes: `httponly=True`, `secure`, `samesite`, `path="/"`, `max_age` (access 24 h; refresh 7 d, demo 24 h to match `SESSION_TTL`/`DEMO_SESSION_TTL`). `clear_auth_cookies` expires both cookies with the **same** path/secure/samesite.
3. **Custom-header CSRF check:** `before_request` hook for `POST`, `PUT`, `PATCH`, `DELETE` under `/api/`: require `X-Requested-With: XMLHttpRequest` else `403 {"error": "Missing required header"}`. `api.ts` sets the header once on the axios instance (already allowed in CORS `allow_headers`). A cross-site page cannot send a custom header without a successful CORS preflight, which the single-origin allow-list denies. Exempt only `OPTIONS` (and nothing else, including login/contact).
4. Keep `JWT_COOKIE_CSRF_PROTECT = False` with a comment explaining the header-based defence.
5. Remove the useless `expose_headers: ["Set-Cookie"]` from the CORS config (browsers never expose it).

## 4. Data and migration

None. Users logged in before the change keep working (cookie names unchanged); their cookies become persistent on the next refresh.

## 5. Security and failure behaviour

- Header check runs before rate limiting? Order: ProxyFix → limiter (by IP) → CSRF header check, so blocked requests still count toward limits.
- The service worker and any non-axios fetch must also send the header (none do state-changing calls today; verify `sw.js` and `analytics.ts`).

## 6. Test plan

- State-changing request without the header → 403; with the header → normal behaviour.
- Cookie attributes after login: `HttpOnly`, `Secure` (when configured), `SameSite`, `Max-Age` equals the TTLs; demo login uses the 24 h refresh TTL.
- Logout response clears both cookies with matching attributes.
- `JWT_COOKIE_SECURE` unset → cookies are Secure.

## 7. Verification

In the browser, log in, close and reopen the browser: still logged in. From a different origin (local HTML page) a `fetch(…/api/auth/logout, {method:'POST', credentials:'include'})` fails.

## 8. Dependencies

- [H3](h3-hardcoded-db-default.md) (config), [H1](h1-logged-out-redirect.md)/[H2](h2-refresh-race.md), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- **You:** confirm there is no cross-origin deployment of the SPA in production (if there is, set `JWT_COOKIE_SAMESITE=None`).
