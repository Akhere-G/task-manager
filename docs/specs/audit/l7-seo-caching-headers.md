# L7: SEO files, caching, compression and security headers

> **Severity:** Low · **Category:** Performance / hardening · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed (files and code); bundle size from an existing, possibly stale `dist/`.
> **Depends on:** [M11](m11-deployment-hardening.md) (image/nginx decisions), [M12](m12-tests-and-ci.md).

## 1. Context and evidence

- `task-manager-frontend/public/robot.txt`: wrong filename (crawlers request `/robots.txt`, which the SPA fallback answers with `index.html`). Its `Sitemap:` line points at `task-flow-ai.up.railway.app`.
- `public/sitemap.xml` uses the same Railway host and `lastmod` 2026-03-04, while the README's live deployment is on Cloud Run.
- Production serves static files through Flask (`app/main.py` `send_from_directory`): no compression, default cache headers, no security headers. `task-manager-frontend/nginx.conf` (which does set `expires` for `/assets/`) is **not used** in the root image.
- Existing `dist/assets/index-*.js` ≈ 635 KB uncompressed (pages are already lazy-loaded in `App.tsx`; charts, calendar and PostHog are in shared chunks).
- No `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` or HSTS on any response.

## 2. Goals and non-goals

**Goals**
- Crawlers find the right robots/sitemap; static assets are compressed and cached; baseline security headers on every response.

**Non-goals**
- Server-side rendering; a CDN; full SEO overhaul.

## 3. Design

### 3.1 SEO files
- Rename `robot.txt` → `robots.txt`; allow public routes (`/`, `/about`, `/contact`, `/login`, `/register`, `/demo`), disallow private routes (as now), `Sitemap: https://<canonical-host>/sitemap.xml`.
- Update `sitemap.xml` hosts and `lastmod`; include `/demo`.
- Canonical host = the production domain (default: the Cloud Run URL in the README) — see open questions.

### 3.2 Flask static serving (`app/main.py` or a new `app/static_headers.py`)
- Dependency `Flask-Compress` (gzip/brotli for text types).
- `after_request`:
  - `/assets/*` (hashed files): `Cache-Control: public, max-age=31536000, immutable`.
  - `index.html`, `/sw.js`, `site.webmanifest`, `robots.txt`, `sitemap.xml`: `Cache-Control: no-cache`.
  - `/api/*`: `Cache-Control: no-store`.
- Security headers on all responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` (only when the request is HTTPS / behind the proxy).
- **CSP rollout:** start with `Content-Security-Policy-Report-Only`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <posthog host>; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'`. Collect violations for at least a week (or review the browser console on every page), then switch to enforcing. `'unsafe-inline'` for styles is needed by Tailwind/recharts inline styles.
- Static files: set `SEND_FILE_MAX_AGE_DEFAULT` consistently and rely on the header hook for specifics.

### 3.3 Bundle
- Run `rollup-plugin-visualizer` once on a fresh build and record sizes in the PR.
- `build.rollupOptions.output.manualChunks` for `recharts`, `react-big-calendar`+`moment`, `posthog-js`.
- Load PostHog lazily: `initAnalytics()` does `const { default: posthog } = await import("posthog-js")` only when a token is configured (also benefits [L4](l4-analytics-and-docs.md)).
- Decide further splitting from the numbers; do not optimise blindly.

### 3.4 nginx (only if the frontend image is kept, [M11](m11-deployment-hardening.md))
`gzip on` for text types, the same headers, `index.html` and `sw.js` no-cache, `/assets/` immutable.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- CSP report-only first so a mistake cannot blank the app.
- Service worker and manifest must stay revalidated or users will not receive updates.

## 6. Test plan

- Flask test client: `/assets/x.js` has immutable cache header; `/` has `no-cache`; `/api/tasks` has `no-store`; security headers present everywhere; `Accept-Encoding: gzip` returns compressed text.
- `/robots.txt` and `/sitemap.xml` return their files (not `index.html`).

## 7. Verification

Lighthouse/securityheaders.com style check on staging; confirm the PWA still updates after a deploy (service worker revalidation); browser console shows no CSP report-only violations on main flows (login, tasks, calendar, stats, AI, push permission).

## 8. Dependencies

- [M11](m11-deployment-hardening.md), [L4](l4-analytics-and-docs.md) (PostHog host), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- **You:** confirm the canonical public domain for `robots.txt`/`sitemap.xml`.
- Decide when to switch CSP from report-only to enforcing.
