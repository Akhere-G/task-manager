# M8: Reminder job correctness

> **Severity:** Medium · **Category:** Bug · **Effort:** Small to Medium · **Status:** Specified, not implemented
> **Finding status:** Code defects confirmed; real-world frequency **Potential** (the schedule of `run_reminders.py` is not in the repo).
> **Depends on:** [M12](m12-tests-and-ci.md) (tests), [M2](m2-error-handling.md) (logging config). Note: `public-demo-mode.md` said "leave `run_reminders.py` alone"; this spec supersedes that for the defects below.

## 1. Context and evidence

`task-manager-backend/app/run_reminders.py`:
- `:66` `select(Task).where(Task.start_at >= now, Task.start_at <= minutes_ahead)`: **no `is_completed` filter**, scans all users.
- No de-duplication: if the job runs more often than every 30 minutes, each task is notified on every run, and a `Notification` row is inserted each time (`:19-21`).
- `:81` `f"{task.category} -- {task.description}"` renders the string "None" for tasks without a description.
- `:36-44` `webpush(...)` is sequential with no timeout; one slow endpoint delays the rest.
- `:1` leftover `print("DEBUG: ...")`; other `print`s instead of logging.
- `:51-53` deletes subscriptions on 404/410 (good) but a single failure otherwise aborts nothing and is only printed.

**Impact:** reminders for tasks already done, repeated reminders, ugly "None" text, job delays.

## 2. Goals and non-goals

**Goals**
- Notify once per (task, start time), only for incomplete tasks.
- Robust, logged, bounded runtime.

**Non-goals**
- Reminders for projected (ghost) occurrences. Only the master row's next occurrence is notified, as today.
- Changing the lead time (30 minutes) or the scheduler.

## 3. Design

### 3.1 Schema
`tasks.reminded_for_start_at DATETIME NULL` (model + idempotent `init_db.py` step `add_tasks_reminded_for_start_at`).

### 3.2 Query
```python
select(Task).where(
    Task.is_completed.is_(False),
    Task.start_at >= now, Task.start_at <= now + 30min,
    or_(Task.reminded_for_start_at.is_(None), Task.reminded_for_start_at != Task.start_at),
)
```
Rescheduling or a repeat advance changes `start_at`, so a new reminder is re-armed automatically.

### 3.3 Per-task processing
- For each task: create the `Notification`, send pushes, then set `task.reminded_for_start_at = task.start_at` and `commit()`. One `try/except Exception` per task, logging and continuing, so a failure on one task neither blocks others nor repeats completed ones.
- Message body: `category` plus ` -- description` only when a description exists (use a helper `reminder_body(task)`).
- `webpush(..., timeout=10)`.
- Batch the subscription query: load subscriptions for all affected user ids in one query instead of one query per task.
- Use `logging` (shared config from M2); remove the debug print.
- Exit code non-zero only for unexpected top-level failures (as today).

### 3.4 Demo user
Unchanged from the demo spec: the demo user may receive notification rows; the demo reset deletes them. No push subscriptions exist for it once [L9](l9-notifications.md) blocks demo subscriptions.

## 4. Data and migration

One nullable column. Existing rows start as `NULL` (may produce at most one extra reminder per upcoming task right after deploy; acceptable).

## 5. Security and failure behaviour

- Notification payloads include task titles; they go only to the owning user's subscriptions.
- The job logs counts, never titles or endpoints.

## 6. Test plan (webpush mocked, MySQL test DB)

- Completed task inside the window is skipped.
- Two consecutive runs notify once; after changing `start_at` a third run notifies again.
- Null description produces no "None".
- One failing subscription (410) is deleted and the batch continues; a generic failure on task A does not prevent task B.
- Timeout argument is passed to `webpush`.

## 7. Verification

Run the job twice against staging data a minute apart with a task starting in 20 minutes; confirm one notification row.

## 8. Dependencies

- [M12](m12-tests-and-ci.md), [M2](m2-error-handling.md) (logging), [L9](l9-notifications.md).

## 9. Open questions and user-only actions

- **You:** tell me (or note in the README) the actual schedule of `run_reminders.py` (cron/Cloud Scheduler interval).
