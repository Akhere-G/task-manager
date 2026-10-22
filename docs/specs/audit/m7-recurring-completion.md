# M7: Recurring-task completion correctness

> **Severity:** Medium · **Category:** Bug / data integrity · **Effort:** Medium · **Status:** Specified, not implemented
> **Finding status:** Potential (code-trace; not reproduced). Reproduce with the concurrency test before changing.
> **Depends on:** [M2](m2-error-handling.md) (validation errors → 400), [M12](m12-tests-and-ci.md) (MySQL test DB).

## 1. Context and evidence

- `task-manager-backend/app/services/task_service.py:185-251` (`update_task`): reads the row without a lock, applies the whitelist, flushes, calls `handle_repeat_task`, then commits.
- `app/utils/task_utils.py:146-177` (`handle_repeat_task`): inserts a history row, advances the master's `start_at`/`end_at`, resets `is_completed`, and **commits mid-request** (line 177).
- The returned dict (`updated_task_dict`, `:232-251`) is built **before** the dates advance, so it describes the pre-advance state while the DB holds the advanced state.
- A lock alone would not fix duplicates: after the first "complete" the master is reset to `is_completed = 0`, so a second identical request is treated as a *new* completion and advances the series again.
- `app/utils/validators.py:56-58`: `end > start` is only checked when both fields are in the request, so a PATCH with only `endAt` (or only `startAt`) can store `end <= start`.

**Impact:** double-click or retry on "complete" can create duplicate history rows and skip periods; inconsistent API response; invalid time ranges stored.

## 2. Goals and non-goals

**Goals**
- Completing the same occurrence twice is a no-op the second time.
- One transaction per update; response equals persisted state.
- Time-range validation uses merged (stored + incoming) values.

**Non-goals**
- Changing recurrence rules or ghost projection.
- Reworking the data model (still one master row plus history rows).

## 3. Design

### 3.1 Transaction and lock
In `update_task`: `select(Task).where(...).with_for_update()`; `handle_repeat_task` flushes only (remove its `commit`); one `db.session.commit()` at the end (rollback on any exception).

### 3.2 Idempotency via `expectedStartAt`
- New optional PATCH field `expectedStartAt` (ISO or `YYYY-MM-DD HH:MM:SS` UTC).
- When the update completes a repeating task (`is_repeating` and transition to completed) and `expectedStartAt` is present, compare it to the locked row's `start_at`. On mismatch return **409** `{"error": "Task already changed", "task": <current>}` with no changes.
- Frontend: `useSetIsCompleted` / `TaskCard` / calendar pass `expectedStartAt: task.startAt` for repeating tasks, and disable the control while the mutation is pending.
- Older clients without the field keep today's behaviour (no 409 check).

### 3.3 Merged validation
After applying the whitelist and before `flush`, check `end_at > start_at` on the merged values. Raise a domain `ValidationError(field="endAt", message=…)`; the route maps it to `400 {"errors": {"endAt": …}}`. Keep the request-level validator for field formats.

### 3.4 Response
Build the response dict from the task row **after** repeat handling (what is persisted). Verify the frontend does not rely on the old shape: `useUpdateTask` only invalidates queries, but check `TaskCard`/`TaskPopups` consumers of the mutation result before shipping.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- `FOR UPDATE` is scoped by `user_id` + `id`, so it cannot lock other users' rows.
- Deadlock/lock-wait errors surface as 503 via [M2](m2-error-handling.md) (with `Retry-After: 1`), not 500.

## 6. Test plan (MySQL)

- Complete an occurrence twice with the same `expectedStartAt`: one history row, master advanced once, second call 409.
- Without `expectedStartAt`, two sequential completes still behave as today (documented).
- Threaded double-submit (two sessions) results in one history row.
- PATCH only `endAt` earlier than stored start → 400; only `startAt` after stored end → 400.
- Response `startAt` equals the DB value after completion.
- Transaction rollback: a failure after history insert leaves no history row.

## 7. Verification

Manual: double-click the complete checkbox on a daily task; confirm one history entry in the list and the next occurrence is tomorrow, not the day after.

## 8. Dependencies

- [M2](m2-error-handling.md), [M12](m12-tests-and-ci.md); touches the same files as [M13](m13-stats-performance.md) (stats caching invalidation) and [L5](l5-maintainability.md) (serializer), so land M7 first.

## 9. Open questions and user-only actions

- Confirm the 409 handling UX (silently refresh the task list and show no error is the recommendation).
