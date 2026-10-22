# L9: Notification list and subscription hardening

> **Severity:** Low · **Category:** Reliability / security hygiene · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed. The subscription-reassignment behaviour was an **accepted risk** in `docs/specs/public-demo-mode.md` (§1.1/§8); this spec reverses that decision for the demo user only.
> **Depends on:** [M2](m2-error-handling.md), [M8](m8-reminder-job.md) (reminders write notifications), [M12](m12-tests-and-ci.md).

## 1. Context and evidence

- `task-manager-backend/app/services/notification.py:6-8` `get_notifications` has no `ORDER BY` and no `LIMIT`: grows forever and returns in arbitrary order. Notifications are inserted by `run_reminders.py` for every upcoming task.
- `notification.py:27-39` `save_subscription` reassigns an existing endpoint to whichever user posts it (`existing_sub.user_id = user_id`). Push endpoints are long unguessable URLs, so abuse is unlikely, but the demo spec noted the shared demo account could steal a real user's subscription on a shared browser.
- `app/schemas/notification_schema.py:51-72` validates only presence; `endpoint` can be any string. The column is `VARCHAR(500)` and keys are `VARCHAR(255)`, so an oversize value reaches the database and fails with a driver error (500).
- No unsubscribe route; logout does not remove the browser's subscription. After a user logs out and another logs in on the same browser, the next subscribe moves the endpoint (intended) but until then pushes keep going to the previous user's account.
- `app/routes/notifications.py` has no demo restriction (the original demo spec planned a 403, removed later).

## 2. Goals and non-goals

**Goals**
- Bounded, ordered notification lists.
- Validated, capped, removable subscriptions; no pushes to a shared demo account.

**Non-goals**
- A notification centre redesign, read-all, deletion of old notifications by users (a retention job can come later).

## 3. Design

1. **List:** `GET /api/notifications` → `ORDER BY created_at DESC, id DESC`, `limit` (default 50, max 100) and optional `before_id` cursor. Response stays a JSON array so the existing frontend keeps working; the badge count uses the same list (verify what the header badge reads before changing the shape).
2. **Subscribe validation** (`SubscriptionCreateSchema`): `endpoint` — `fields.URL(schemes={"https"}, required=True)` with `Length(max=500)`; `keys.p256dh`/`keys.auth` — `Length(max=255)`; reject unknown fields.
3. **Demo user:** `subscribe` returns `403 {"error": "Not available in demo mode."}` when `is_demo_user(user_id)`.
4. **Per-user cap:** after saving, if the user has more than 10 subscriptions, delete the oldest.
5. **Unsubscribe:** `DELETE /api/notifications/subscribe` with body `{"endpoint": "..."}`; deletes only the caller's row (`WHERE endpoint = :e AND user_id = :uid`), idempotent (204/200 either way).
6. **Frontend:** in `AuthContext.logout`, before calling `/auth/logout`, read the current push subscription (`registration.pushManager.getSubscription()`), call the DELETE endpoint with its endpoint, ignore failures, then continue logging out. The reassign-on-conflict behaviour stays for the same-browser re-login case.
7. **Model alignment:** add `ondelete="CASCADE"` to the `Notification` and `NotificationSubscription` foreign keys in the models (matches the real tables; see [L5](l5-maintainability.md)).

## 4. Data and migration

None required. The cap step may delete old rows for users above 10.

## 5. Security and failure behaviour

- DELETE is scoped by user id, so one user cannot remove another's subscription.
- Unsubscribe failure never blocks logout.
- CSRF header requirement from [L1](l1-cookies-and-csrf.md) applies to the new DELETE.

## 6. Test plan

- Ordering and limit/cursor: 120 rows → default 50 newest first; `limit=1000` clamps to 100; `before_id` pages.
- Demo user subscribe → 403.
- `http://…` endpoint, 501-character endpoint, oversize key → 400 (not 500).
- 11th subscription removes the oldest.
- Unsubscribe removes only the caller's row; calling twice succeeds; other user's endpoint unaffected.
- Isolation test: user A cannot read B's notifications or mark them read (already scoped; keep in `test_isolation.py`).

## 7. Verification

Browser: subscribe, log out, confirm the subscription row is gone and a test push does not arrive; log in as another user and subscribe again.

## 8. Dependencies

- [M2](m2-error-handling.md), [M8](m8-reminder-job.md), [L1](l1-cookies-and-csrf.md), [L5](l5-maintainability.md), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- Confirm what the header notification badge reads before changing the list endpoint (kept as an array to avoid breaking it).
