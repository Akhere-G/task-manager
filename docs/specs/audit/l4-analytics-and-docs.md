# L4: Analytics defaults, hardcoded URLs and documentation drift

> **Severity:** Low · **Category:** Privacy / documentation · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** none (touch `.env.example` together with [H3](h3-hardcoded-db-default.md), [H4](h4-redis-rate-limiting.md), [M4](m4-db-tls.md), [L2](l2-contact-email.md), [M14](m14-ai-reliability.md)).

## 1. Context and evidence

- `task-manager-frontend/src/services/analytics.ts:56-58`: `POSTHOG_KEY = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || "<hardcoded project key>"`. The README says analytics are "off unless configured"; in reality local development and forks send events to the production PostHog project. (The key is a public project key, not a secret.)
- `analytics.ts:62-63`: two `console.log` lines run in production.
- `src/services/api.ts:5-7`: base URL falls back to the **production** API URL.
- README states Pomodoro "Completed sessions are automatically logged against your tasks". I found no API call or table for that: `Pomodoro.tsx` only counts sessions locally and marks the task complete.
- Task titles, descriptions and categories are sent to third-party LLM providers (`ai_service.py:104-109,192`); the README's privacy note only covers PostHog.
- `task-manager-backend/.env.example` lacks variables the code reads (`FRONTEND_URL`, `MAIL_USERNAME`, `VAPID_PRIVATE_KEY`) and, after these specs, new ones. It lists nothing for `FRONTEND_DOMAIN`/`MAIL_PASSWORD`, which appear in the real `.env` but are not read anywhere I found.
- The recent "fixing key mismatch" commits show the Docker build-arg names (`_VITE_POSTHOG_PROJECT_TOKEN`) are easy to get wrong.

## 2. Goals and non-goals

**Goals**
- Analytics are really off unless configured; no accidental production writes from dev.
- Docs match behaviour; example env files are complete.

**Non-goals**
- Changing what is tracked; adding consent UI.

## 3. Design

1. `analytics.ts`: remove the fallback key (`POSTHOG_KEY = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN`); `initAnalytics()` already returns early when it is empty. Delete both `console.log` statements.
2. `api.ts`: `baseURL: import.meta.env.VITE_API_URL || "/api"` (same origin in the root image; Vite dev proxy or `VITE_API_URL` for local dev). Add a Vite dev `server.proxy` entry for `/api` → backend if not present.
3. **Production build check:** since the key now comes only from the build, verify the deploy pipeline passes `_VITE_POSTHOG_PROJECT_TOKEN` and `_VITE_POSTHOG_HOST` (Cloud Build substitutions). Add a startup `console.info` only in development builds stating whether analytics is enabled (no key values).
4. README:
   - Pomodoro: reword to what exists ("A 25-minute focus timer per task; finishing a session lets you mark the task complete"). If session logging is wanted it is a separate feature.
   - Add a "Data sent to third parties" note: AI features send task title/description/category to the configured LLM providers.
   - Document `REDIS_URL`, `DB_SSL_CA`, `JWT_COOKIE_SECURE`, `JWT_COOKIE_SAMESITE`, `CONTACT_TO_EMAIL`, `GEMINI_MODEL`, `GROQ_MODEL`, and the Docker build.
5. `task-manager-backend/.env.example`: regenerate from `grep -rn "os.getenv\|environ" app init_db.py` plus the new variables, with a one-line comment each. Remove unused entries only after confirming with grep. Keep `task-manager-frontend/.env.example` aligned.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- No secrets in example files; empty values only.
- Removing the fallback means a mis-configured pipeline silently disables analytics; mitigated by the build check above.

## 6. Test plan

- Vitest: with no token, `trackEvent` is a no-op and `posthog.init` is not called (mock `posthog-js`).
- Grep checks in CI (optional): no `console.log` in `src/` apart from allowed files; no `phc_` string in source.

## 7. Verification

Run `vite build` without the token and search the bundle for `us.i.posthog.com` requests at runtime (none). Run with the token and confirm events arrive.

## 8. Dependencies

- Coordinates with [H3](h3-hardcoded-db-default.md), [H4](h4-redis-rate-limiting.md), [M4](m4-db-tls.md), [L2](l2-contact-email.md), [M14](m14-ai-reliability.md) for the env list; [M11](m11-deployment-hardening.md) for the Docker docs.

## 9. Open questions and user-only actions

- **You:** confirm Cloud Build passes the PostHog substitutions; confirm `FRONTEND_DOMAIN` and `MAIL_PASSWORD` are unused before they are dropped from your real `.env`.
