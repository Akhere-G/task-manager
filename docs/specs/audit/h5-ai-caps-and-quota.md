# H5: Cap AI inputs, add quotas and timeouts

> **Severity:** High (cost exposure) · **Category:** Security / cost · **Effort:** Small to Medium · **Status:** Specified, not implemented
> **Note:** `docs/specs/public-demo-mode.md` recorded "no new rate limiting, quotas or demo-specific AI behaviour" as an accepted decision. This spec supersedes that decision for AI cost control only; **demo login and demo data behaviour are not changed.**
> **Depends on:** [H4](h4-redis-rate-limiting.md) (Redis, per-IP limits), [M2](m2-error-handling.md) (input helper, error shape).

## 1. Context and evidence

- `task-manager-backend/app/routes/ai_routes.py:27-58`: `parse-task` and `decompose` accept any text length, have no quota, and `decompose` has no `try/except` or type checks.
- `app/services/ai_service.py:30-56`: Gemini is called with no timeout; Groq has a 10 s timeout; errors are swallowed (`except Exception: pass`).
- `app/routes/auth_routes.py:159-194`: `POST /api/auth/demo` gives any visitor a session, so these routes are reachable without registration.
- The daily brief is cached per user per day (`generate_daily_brief`) and is not the main exposure.

**Impact:** anyone can drive unlimited paid LLM calls; a hung provider call blocks a gunicorn worker.

## 2. Goals and non-goals

**Goals**
- Bounded input size.
- Per-user daily quota, with the shared demo account capped globally.
- Provider timeouts so a slow provider cannot hold a worker.

**Non-goals**
- Changing prompts or models ([M14](m14-ai-reliability.md)).
- Billing/usage dashboards.

## 3. Design

### 3.1 Input validation
New helpers in `app/utils/validators.py` (used after `get_json_body()` from [M2](m2-error-handling.md)):

- `validate_parse_task(data)`: `text` is a string, 1 to 500 characters after strip.
- `validate_decompose(data)`: `title` 1 to 255; `description` 0 to 2,000; `category` in the valid list (reuse `VALID_CATEGORIES`, hoisted to a module constant); `start_at`/`end_at` parseable with `isoparse` and `end_at > start_at`.
Return `400 {"errors": {...}}`.

### 3.2 Daily quota (Redis, from H4)
- Key: `ai:{user_id}:{YYYY-MM-DD in UTC}`; `INCR`, and on first increment `EXPIREAT` the end of the UTC day.
- Limits in `config.py`: `AI_DAILY_LIMIT = 30` for real users; `AI_DAILY_LIMIT_DEMO = 60` for the demo account. The demo account is a single shared user, so its key acts as a global demo cap.
- Per-IP limit on both AI routes: 10/hour (limiter from H4).
- Exceeding: `429 {"error": "Daily AI limit reached. Try again tomorrow."}`.
- **Fail closed:** if Redis is unreachable the quota check returns `503 {"error": "AI is temporarily unavailable."}`. Cost risk outweighs availability for these optional features.
- Daily brief is not counted (cached).
- Implement as a decorator `@ai_quota` in `app/utils/quota.py` applied to `parse-task` and `decompose`.

### 3.3 Timeouts
- Gemini: set an explicit request timeout of 10 s. **Pre-implementation check:** confirm the option name in the installed `google-genai` 1.65 (`HttpOptions(timeout=...)`, milliseconds) by reading the SDK in `venv/` before coding.
- Groq: keep `timeout=10.0`.
- Cap the formatted prompt length (for example 6,000 characters) before sending.

### 3.4 Frontend
`AiAddTaskForm` and `DecomposeTask` show distinct messages for 400 (input), 429 (limit) and 503 (unavailable); no automatic retry.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Quota keys contain only user ids and dates.
- Provider failures return 502-style JSON (via [M2](m2-error-handling.md)), not raw exception text.

## 6. Test plan (providers mocked)

- Over-length `text`, bad category, non-string title each return 400 and do not call the provider.
- The 31st AI call in a day returns 429; the counter resets on a new date (patch the clock).
- Demo user uses the demo limit.
- Redis down returns 503 and does not call the provider.
- Timeout path: a mocked slow Gemini call falls through to Groq within the timeout.

## 7. Verification

Staging: exhaust the limit with a script, confirm 429s and that Gemini/Groq usage dashboards stop increasing.

## 8. Dependencies

- [H4](h4-redis-rate-limiting.md), [M2](m2-error-handling.md), [M14](m14-ai-reliability.md) (same file, do after).

## 9. Open questions and user-only actions

- **You:** set spend caps/alerts in the Gemini and Groq consoles and a Cloud Run max-instances limit.
- Confirm the daily limits (30 / 60).
