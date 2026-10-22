# H4: Redis-backed rate limiting

> **Severity:** High · **Category:** Security / abuse · **Effort:** Medium · **Status:** Specified, not implemented
> **Decision recorded:** use Redis to track client IPs. The user will add the Redis URL to `.env` as `REDIS_URL`.
> **Depends on:** [H3](h3-hardcoded-db-default.md) (config), [M2](m2-error-handling.md) (429 JSON handler). Provides Redis for [H5](h5-ai-caps-and-quota.md) and [M13](m13-stats-performance.md).

## 1. Context and evidence

No rate-limiting dependency or code exists (`requirements.txt`, `app/`). Open endpoints:

| Endpoint | Source | Risk |
|---|---|---|
| `POST /api/auth/login` | `auth_routes.py:122` | credential stuffing / brute force |
| `POST /api/auth/register` | `auth_routes.py:73` | account spam |
| `POST /api/auth/request-password-reset` | `auth_routes.py:226` | mail-bombing any address, MailerSend quota |
| `POST /api/auth/reset-password` | `auth_routes.py:261` | token guessing (low), load |
| `POST /api/contact` | `mail_routes.py:39` | unauthenticated email sending |
| `POST /api/auth/demo` | `auth_routes.py:159` | free sessions, DB row growth |

The app runs on Cloud Run with multiple instances, so an in-memory limiter is per instance and weak.

## 2. Goals and non-goals

**Goals**
- Per-IP and per-identity limits shared across instances.
- Correct client IP behind Cloud Run.
- Limiter problems never take the app down.

**Non-goals**
- Per-user AI quotas (see [H5](h5-ai-caps-and-quota.md)).
- A WAF / Cloud Armor setup.
- Changing demo functionality.

## 3. Design

### Dependencies
`Flask-Limiter`, `redis` (add to `requirements.txt`).

### Module `app/extensions.py`
```python
limiter = Limiter(
    key_func=client_ip,
    storage_uri=os.getenv("REDIS_URL") or "memory://",
    default_limits=["300 per minute"],
    swallow_errors=True,                 # fail open on Redis errors
    in_memory_fallback_enabled=True,
    headers_enabled=True,
)
```
- `limiter.init_app(app)` in `create_app()`.
- If `REDIS_URL` is unset, log a WARNING and use `memory://` (dev and tests only).
- Exempt `/health`, `/api/keep-alive` and static files.

### Client IP
Wrap the WSGI app: `app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)`. **Pre-implementation check:** deploy a build that logs `request.remote_addr` and the raw `X-Forwarded-For` for one request on Cloud Run, then set `x_for` to the number of trusted hops that yields the real client address. Without this every user would share the proxy's IP (and one user could lock everyone out).

### Limits (constants in `app/config.py`, adjustable)

| Route | Limit |
|---|---|
| login | 10/min per IP **and** 5 per 15 min per IP+email (key: SHA-256 of lower-cased email) |
| register | 5/hour per IP |
| request-password-reset | 3/hour per IP **and** 3/hour per email |
| reset-password | 10/hour per IP |
| contact | 3/hour per IP |
| demo | 20/hour per IP |
| refresh | 60/min per IP |
| all other `/api` | 300/min per IP (default) |

### Responses
`RateLimitExceeded` handler (in `errors.py`, [M2](m2-error-handling.md)) returns `429 {"error": "Too many requests. Try again later."}` with `Retry-After`.

### Frontend
Show a friendly message on 429 in Login, Register, RequestPasswordReset, ResetPassword and Contact (`"Too many attempts. Try again in N minutes."` using `Retry-After`). Do not retry automatically.

### Config and docs
Add `REDIS_URL` to `.env.example` and README. The local compose file ([M11](m11-deployment-hardening.md)) includes a Redis service.

## 4. Data and migration

None (Redis keys only; limiter manages TTLs).

## 5. Security and failure behaviour

- **Fail open** if Redis is unavailable: log at WARNING once per minute, serve requests (with the in-memory fallback still counting per instance).
- Per-email keys use a hash so emails are not stored in Redis in clear text.
- Account-targeted limits mean an attacker can lock out one email's login attempts for the window; acceptable trade-off, mention in README. Successful login does not reset the counter in this version.

## 6. Test plan (memory storage in tests)

- 11th login attempt within a minute from one IP returns 429 with `Retry-After`.
- Per-email limit triggers across different IPs (patch `client_ip`).
- Register/reset/contact limits trigger at the configured counts.
- `/health` is never limited.
- With the storage patched to raise, requests still succeed (fail open).
- Optional CI job with the Redis service container runs the same login test against real Redis.

## 7. Verification

- Deploy to staging, hit login 11 times, observe 429, confirm another network is unaffected.
- Check Redis keys exist (`redis-cli --scan`), expire, and contain no raw emails.

## 8. Dependencies

- [H3](h3-hardcoded-db-default.md), [M2](m2-error-handling.md), [M11](m11-deployment-hardening.md) (compose Redis), [M12](m12-tests-and-ci.md) (CI Redis service).

## 9. Open questions and user-only actions

- **You:** provision Redis and add `REDIS_URL` to `.env` and Cloud Run (a managed Redis in the same region; Cloud Run needs a VPC connector or Direct VPC egress if the instance is private).
- Confirm the limit values, especially the contact (3/hour) and demo (20/hour) numbers.
