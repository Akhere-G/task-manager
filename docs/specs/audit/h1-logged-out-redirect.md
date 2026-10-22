# H1: Stop redirecting logged-out visitors to `/login`

> **Severity:** High · **Category:** Bug / user flow · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed by code trace (not reproduced at runtime). Reproduce first (see Verification).
> **Depends on:** none. Ships together with [H2](h2-refresh-race.md) (same file).

## 1. Context and evidence

On every page load `AuthContext` calls `GET /auth/me` (`task-manager-frontend/src/context/AuthContext.tsx:39-55`). For a logged-out visitor that returns 401. The response interceptor (`src/services/api.ts:14-36`) then:

1. sets `_retry` and calls `POST /auth/refresh` (line 28-30), which also returns 401;
2. the 401 branch for `/auth/refresh` (line 19-27) runs `window.location.href = "/login"` unless the path is `/login` or `/register`.

There is no allow-list for the other public routes. Affected: `/reset-password?token=…` (emailed link), `/login/request-password-reset`, `/demo` (the README "Try the demo" link), `/about`, `/contact`.

**Impact:** a user opening the reset link in a fresh session is sent to `/login` and the token is lost. Direct links to public pages bounce.

## 2. Goals and non-goals

**Goals**
- Logged-out visitors can open every public route directly.
- A session that expires mid-use still ends up on the login screen, and the `session_expired` analytics event still fires.

**Non-goals**
- Changing the server auth model (see H2/M5/M6).
- Changing which routes are public.

## 3. Design

Files: `task-manager-frontend/src/services/api.ts`, `src/context/AuthContext.tsx`, `src/App.tsx`.

1. **No refresh for auth endpoints.** In the interceptor, skip the refresh-and-retry path when the failing request URL is one of `/auth/me`, `/auth/refresh`, `/auth/login`, `/auth/register`, `/auth/demo`, `/auth/logout`. Reject the error unchanged. Implement as a small `AUTH_URLS` set, or a per-request config flag `skipAuthRefresh`.
2. **Remove the hard redirect.** Delete `window.location.href = "/login"`. `AuthContext.checkSession` already catches the 401 and sets "unauthenticated", and `ProtectedRoute` already redirects private pages.
3. **Mid-session expiry hook.** `api.ts` exports `setSessionExpiredHandler(fn)`. When a *data* request gets 401 and the refresh then fails, call the handler once (guard against repeat calls with a module flag reset on login).
4. `AuthContext` registers a handler in an effect: if `hasAnalyticsSession()` then `trackEvent("session_expired", undefined, { beacon: true })`; then `endAnalyticsSession()`, `setUser(null)`, `setIsAuthenticated(false)`, `queryClient.clear()`. `ProtectedRoute` then redirects.
5. In `App.tsx` change the private-route `redirectTo` to `/login` (default is `/register`) so an expired session lands on the login screen.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- A refresh failure never loops: the refresh request itself is excluded from retry logic.
- Public pages make one `/auth/me` call that returns 401 quietly; do not log it as an error to the console (keep `console.error` only for non-401 failures).

## 6. Test plan (Vitest + `axios-mock-adapter`, added by [M12](m12-tests-and-ci.md))

- `/auth/me` 401 does not navigate and rejects with the original error.
- A data call 401 triggers exactly one refresh, then retries once and returns data.
- Data call 401 then refresh 401 calls the session-expired handler exactly once and does not set `window.location`.
- `AuthContext`: handler clears the user and fires `session_expired` only when an analytics session existed.

## 7. Verification

- Before the change, reproduce: logged out, open `/reset-password?token=x` and `/demo`; expect a bounce to `/login`.
- After: both pages render; reset form shows with the token intact.
- Logged in, delete the `access_token_cookie` and `refresh_token` cookies in dev tools, trigger a data refetch; expect the user to land on `/login`.

## 8. Dependencies

- [H2](h2-refresh-race.md): same interceptor; implement together.
- [M12](m12-tests-and-ci.md): provides the frontend test runner.

## 9. Open questions and user-only actions

None.
