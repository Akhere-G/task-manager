# M9: Bound the task list endpoint

> **Severity:** Medium · **Category:** Performance / reliability · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed by code trace.
> **Depends on:** [M2](m2-error-handling.md) (400 responses). Touches the frontend export in `Settings.tsx` (see [L8](l8-csv-formula-guard.md) for the same file).

## 1. Context and evidence

- `task-manager-backend/app/utils/task_utils.py:55-119` (`with_repeating`): with `project_repeating=true`, a ghost task is generated for every period in `[start_date, end_date]` for each recurring task. A request with `start_date=2000-01-01&end_date=2100-12-31` and a daily task creates about 36,500 ghosts per task. No clamp.
- `app/services/task_service.py:53`: when `limit` is absent the limit becomes `total_count`, so the whole table is returned (frontend export relies on this: `Settings.tsx` uses `perPage: null`).
- `task_service.py:84-95`: `project_repeating` with missing dates → `parse_date(None)` → `None.replace(...)` raises `AttributeError` → 500.
- `task_service.py:52-53`: `int(page)` / `int(limit)` with non-numeric input raise `ValueError` → 500. Invalid ISO dates in `build_task_filters` do the same.
- `app/routes/task_routes.py:18-50` has no `try/except` or validation.

**Impact:** a single authenticated request can consume CPU/memory on the worker; bad input yields 500s.

## 2. Goals and non-goals

**Goals**
- All query parameters validated; bad input returns 400.
- Hard bounds on page size, date span and ghost count.
- Export keeps working.

**Non-goals**
- Changing filters or sort options.
- Search behaviour ([M10](m10-safe-search.md)).

## 3. Design

### 3.1 `parse_list_params(args) -> (params, errors)` in `app/utils/validators.py`
- `page`: int ≥ 1 (default 1).
- `limit`: int in `[1, 200]` when present; when absent apply `MAX_TASKS_PER_REQUEST = 2000`.
- `start_date`, `end_date`: parse with `dateutil.parser.isoparse`; if one is present the other is required; `end >= start`.
- `project_repeating=true` requires both dates and a span ≤ `MAX_PROJECTION_DAYS = 400`.
- `is_completed`: one of `true`, `false`, `all`; `sort_by`/`order`/`duration`/`category` keep their existing whitelists (invalid → 400 rather than silent default is optional; keep current silent defaults to avoid breaking old URLs).
- Return `{"errors": {param: message}}` with 400.

### 3.2 Ghost cap
`with_repeating` stops after `MAX_GHOSTS = 5000` total and logs a warning (defence in depth on top of the span clamp).

### 3.3 Frontend
- Audit every `perPage` passed to `useTasks` (Home, TaskList, TaskCalendar, Settings) to ensure none exceeds 200.
- `Settings.tsx` export: replace the single "all tasks" call with a loop fetching pages of 200 until `currentPage >= totalPages`, then build the CSV (keep progress/disabled state).
- Calendar: confirm the date span (`calendar_view` is month ± 6 days) is under 400 days.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- Errors are 400s with a message per parameter, no internals.
- Combined with [H4](h4-redis-rate-limiting.md) the endpoint is also request-rate limited.

## 6. Test plan

- 100-year span with `project_repeating=true` → 400.
- `project_repeating=true` without dates → 400 (previously 500).
- `page=abc`, `limit=0`, `limit=1000`, `start_date=banana` → 400.
- No `limit` returns at most 2000 rows (seed 2100 rows).
- Ghost cap triggers on a synthetic daily task over 400 days × many tasks.
- Valid calendar request (month view) still returns ghosts.

## 7. Verification

Frontend: export a user with more than 200 tasks and compare row count to the database; open Calendar for several months.

## 8. Dependencies

- [M2](m2-error-handling.md); coordinate with [M10](m10-safe-search.md) (same builder) and [M13](m13-stats-performance.md) (uses `with_repeating`).

## 9. Open questions and user-only actions

- Confirm limits (200 per page, 2000 cap, 400-day span).
