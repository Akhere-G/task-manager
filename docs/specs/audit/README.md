# Audit specs: index

Audit date: 2026-10-22. Full report: [audit-findings.md](audit-findings.md). Each problem below has its own implementation spec. **Nothing in these specs has been implemented**; application code, configuration and dependencies are untouched until you give a separate go-ahead.

Scope decisions: **M1** (dependency version bumps) and **L10** (repo hygiene) are in the report but have no spec. **H3**: the hardcoded password was not a real secret (no rotation, no history rewrite). **H4**: Redis, `REDIS_URL` supplied by you. **M5**: opportunistic purge on login, demo behaviour unchanged.

## Specs

| ID | Spec | Severity | Effort | Depends on |
|---|---|---|---|---|
| H1 | [Logged-out redirect breaks reset link and public pages](h1-logged-out-redirect.md) | High | S | M12 (tests) |
| H2 | [Refresh race forces logouts](h2-refresh-race.md) | High | S + S | H1, M5, M6 |
| H3 | [Hardcoded DB fallback, fail-fast config](h3-hardcoded-db-default.md) | High | S | none |
| H4 | [Redis rate limiting](h4-redis-rate-limiting.md) | High | M | H3, M2 |
| H5 | [AI input caps, quotas, timeouts](h5-ai-caps-and-quota.md) | High | S-M | H4, M2 |
| M2 | [Consistent error handling](m2-error-handling.md) | Medium | M | H3 |
| M3 | [Engine options never applied](m3-engine-options.md) | Medium | S | H3 |
| M4 | [TLS for the DB connection](m4-db-tls.md) | Medium | S | M3, H3 |
| M5 | [Session table index + purge on login](m5-session-table-purge.md) | Medium | S | M6 |
| M6 | [Revoke on reset, hash stored tokens](m6-token-hardening.md) | Medium | S-M | M5, H2 |
| M7 | [Recurring completion correctness](m7-recurring-completion.md) | Medium | M | M2, M12 |
| M8 | [Reminder job](m8-reminder-job.md) | Medium | S-M | M12 |
| M9 | [List endpoint limits](m9-list-endpoint-limits.md) | Medium | S | M2 |
| M10 | [Safe full-text search](m10-safe-search.md) | Medium | S | M2, M9 |
| M11 | [Deployment hardening](m11-deployment-hardening.md) | Medium | S-M | H3, H4 |
| M12 | [Tests and CI](m12-tests-and-ci.md) | Medium | M-L | none (first step) |
| M13 | [Stats performance](m13-stats-performance.md) | Medium | M-L | H4, M7, M12 |
| M14 | [AI provider reliability](m14-ai-reliability.md) | Medium | S-M | H5 |
| L1 | [Cookies and CSRF](l1-cookies-and-csrf.md) | Low | S | H1, H2, H4 |
| L2 | [Contact email hardening](l2-contact-email.md) | Low | S | H4, M2 |
| L3 | [Reset-flow polish](l3-reset-flow.md) | Low | S | H3, M6 |
| L4 | [Analytics defaults and docs](l4-analytics-and-docs.md) | Low | S | none |
| L5 | [Maintainability](l5-maintainability.md) | Low | M | M12 |
| L6 | [Frontend smells](l6-frontend-smells.md) | Low | S | M12 |
| L7 | [SEO, caching, headers](l7-seo-caching-headers.md) | Low | S | M11 |
| L8 | [CSV formula guard](l8-csv-formula-guard.md) | Low | S | M12 |
| L9 | [Notifications](l9-notifications.md) | Low | S | M2, M8 |

Effort key: S ≤ 2 hours, M ≈ half a day to a day, L = several days.

## Implementation order

```
Step 0  M12 harness + CI skeleton            (every later spec adds tests here)
Phase 1 H3 + M3 + M4  ->  M2  ->  M5 + M6 + H2 (backend)  ->  H1 + H2 (frontend)
Phase 2 H4  ->  H5  ->  L1  ->  L2, L3
Phase 3 M9, M10  ->  M7  ->  M8
Phase 4 M11  ->  L4, L7, L8, L9
Phase 5 M14  ->  M13 (measure first)  ->  L5  ->  L6
```

Groupings that should be one change set: H3 + M3 + M4 (config/DB layer); M5 + M6 + H2 backend (one migration batch, one `auth_service.py` change); H1 + H2 frontend (same interceptor); M9 + M10 (same query builder).

Indicative effort: Step 0 about 1 day; Phase 1 2-3 days; Phase 2 2-3 days; Phase 3 2 days; Phase 4 1.5-2 days; Phase 5 3-5 days.

## Things only you can do

- Provision Redis and add `REDIS_URL` to `.env` and Cloud Run (H4, H5, M13).
- Confirm the database provider's CA for `ca.pem` before enabling TLS (M4).
- Set spend caps/alerts in the Gemini and Groq consoles and a Cloud Run max-instances limit (H5).
- Confirm the Cloud Build trigger passes `_VITE_POSTHOG_PROJECT_TOKEN` / `_VITE_POSTHOG_HOST` (L4).
- Confirm the canonical public domain for `robots.txt` / `sitemap.xml` (L7) and the contact recipient address (L2).
- Tell me how production images are built and the reminder job's schedule (M11, M8).
- Make sure Cloud Run has all required variables, especially `FRONTEND_URL`, before the fail-fast config ships (H3).
- Enable branch protection after the first green CI run (M12).

## Defaults chosen (change any of them in the relevant spec)

1. The rate limiter fails open if Redis is down; the AI quota fails closed.
2. Existing sessions and pending resets survive the token-hash migration (SHA-256 backfill).
3. `expectedStartAt` is an optional new PATCH field; old clients still work.
4. Cookies default to `Secure` and `SameSite=Lax`; a split-origin deployment must opt into `SameSite=None`.
5. Alembic comes last; earlier migrations are `init_db.py` steps that the Alembic baseline absorbs.
6. DB TLS is staged and only enabled after the CA is confirmed.

## Pre-implementation checks the specs call out

- Cloud Run `X-Forwarded-For` hop count for the real client IP (H4).
- `google-genai` timeout option name and the Gemini/Groq model names (H5, M14).
- Reproduce H1 (open `/reset-password?token=x` logged out) and the M7 double-completion before changing code.
- Production `SHOW CREATE TABLE` for model/DB alignment (L5).

## Not covered by the audit

See "Checks not performed" in [audit-findings.md](audit-findings.md#3-checks-not-performed): no runtime testing, no production access, dependency exploitability not triaged, not every component reviewed, no profiling.
