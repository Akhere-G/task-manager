# M13: Stats performance

> **Severity:** Medium · **Category:** Performance · **Effort:** Medium to Large (swing item: step 4) · **Status:** Specified, not implemented
> **Finding status:** Potential (design is O(n) per request; no profiling was done).
> **Approach:** measure first; only rewrite if the numbers justify it.
> **Depends on:** [H4](h4-redis-rate-limiting.md) (Redis for caching), [M7](m7-recurring-completion.md) (cache invalidation points), [M12](m12-tests-and-ci.md) (regression tests), [M9](m9-list-endpoint-limits.md) (shared `with_repeating`).

## 1. Context and evidence

- `task-manager-backend/app/services/stats_service.py:285-329` (`get_all_dashboard_stats`) loads **every task of the user** into Python dicts, projects 30 days of ghost occurrences with `with_repeating`, then runs 11 aggregation loops over the full list.
- `app/services/ai_service.py:73-81` calls `get_all_tasks(...)` and `get_all_dashboard_stats(user_id)` again for the daily brief.
- `stats_service.py:203-204` (`_get_estimation_accuracy`) calls `.timestamp()` on naive datetimes, which interprets them in the **server's local time**, while the rest of the module treats them as UTC. Only correct when the server runs in UTC.
- No composite indexes exist for the common filters (`user_id` has the FK index only).
- The service runs on a single sync gunicorn worker by default ([M11](m11-deployment-hardening.md)), so a slow dashboard request delays everyone.

**Impact:** fine for tens to hundreds of tasks; latency and memory grow linearly for heavy users or after CSV imports.

## 2. Goals and non-goals

**Goals**
- Know the real cost at 5,000 and 20,000 tasks.
- Cheap wins now; larger rewrite only if needed.
- Identical chart output (no visible change).

**Non-goals**
- Changing chart definitions, time windows or the frontend.
- A reporting database / materialised views.

## 3. Design

### Step 1: measure
- Request-duration log line (method, route, status, ms) added to the logging config from [M2](m2-error-handling.md).
- `scripts/seed_perf.py` (refuses to run unless `DB_NAME` ends with `_test`): inserts 5,000 and 20,000 tasks for one user, ~10% recurring, mixed categories and completion dates.
- Record `GET /api/stats/dashboard` and `GET /api/ai/daily-brief` (providers mocked) timings and RSS in `docs/specs/audit/m13-results.md` (new, short).

### Step 2: cheap fixes (always do)
- Idempotent migration: `idx_tasks_user_end (user_id, end_at)` and `idx_tasks_user_completed (user_id, is_completed, completed_at)`.
- Fix `_get_estimation_accuracy`: attach UTC before `.timestamp()` (`t["end_at"].replace(tzinfo=timezone.utc).timestamp()`), same for `completed_at`.
- `generate_daily_brief` should not compute the full dashboard payload twice; reuse the cached stats (step 3) or compute only the needed pieces (weekly productivity, category volume).

### Step 3: cache
- Redis key `stats:{user_id}:{version}` holding the JSON payload, TTL 60 s; version from `stats_ver:{user_id}` (integer).
- Bump `stats_ver:{user_id}` in `create_task`, `create_tasks_from_list`, `update_task`, `delete_task` (after commit). If Redis is down, skip the cache silently (log once).
- The payload depends on "now" (overdue calculation), so the 60 s TTL bounds staleness.

### Step 4: SQL aggregation (**only if step 1 shows > ~300 ms at 5,000 tasks**)
- Move these to SQL `GROUP BY` queries: productivity trend (completed per day, 366-day window), time spent per category, backlog health counts, category volume, overdue distribution buckets, hourly productivity, turnaround histogram.
- Keep ghost-dependent charts (week overview, deadline proximity) in Python but over a narrowed set: non-completed tasks with `end_at` in the next 7 days, plus repeating masters.
- Regression guard first: a fixture dataset and a test that records the output of the **current** implementation per aggregate (golden JSON), then asserts the new implementation produces the same values.

## 4. Data and migration

Two composite indexes (step 2). Index creation on a large table can lock writes briefly; run during a quiet period.

## 5. Security and failure behaviour

- Cache keys contain only numeric user ids; cached payloads are per user and never shared.
- Cache failure must not fail the request.

## 6. Test plan

- Golden-output tests for all 11 aggregates (before and after any change).
- Cache: second call within 60 s does not run the aggregation (patch counter); mutation bumps the version and the next call recomputes; Redis down still returns data.
- Timestamp fix: with `TZ=America/New_York` the estimation values equal those under `TZ=UTC`.

## 7. Verification

Repeat the step 1 measurements after each step and record them; stop when the target (< 300 ms at 5,000 tasks, < 1 s at 20,000) is met.

## 8. Dependencies

- [H4](h4-redis-rate-limiting.md), [M7](m7-recurring-completion.md), [M9](m9-list-endpoint-limits.md), [M12](m12-tests-and-ci.md), [M14](m14-ai-reliability.md) (brief).

## 9. Open questions and user-only actions

- Acceptable latency target? (Defaults above.)
