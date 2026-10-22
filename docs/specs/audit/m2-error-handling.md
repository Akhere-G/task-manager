# M2: Consistent error handling

> **Severity:** Medium · **Category:** Bug / information leak · **Effort:** Medium · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** [H3](h3-hardcoded-db-default.md) (app factory changes). Prerequisite for [H4](h4-redis-rate-limiting.md), [H5](h5-ai-caps-and-quota.md), [M9](m9-list-endpoint-limits.md), [M10](m10-safe-search.md).

## 1. Context and evidence

- `task-manager-backend/app/main.py:98-101`: the 404 handler returns `index.html` with HTTP 200 for **every** unknown URL, including unknown `/api/*` routes.
- `main.py:103-120`: the `500` and `Exception` handlers return `str(e)` to clients and use `print` for logging.
- `@app.errorhandler(Exception)` also catches Werkzeug `HTTPException`s, so bad JSON (400), wrong content type (415) and wrong method (405) become `500 "Uncaught Exception"`.
- Many routes catch everything and return the exception text: `auth_routes.py:119,156,194,208,223,258,285,314`, `ai_routes.py:24,39`, `mail_routes.py:71-74` (also `print`).
- `request.json` is `None` or raises on bad input and is used unguarded: `task_routes.py:74,94,131`, `ai_routes.py:31,45`, `mail_routes.py:40`, `notifications.py:46`.

**Impact:** information disclosure (driver/SQL/mailer text), misleading monitoring (client errors counted as 500), API clients cannot detect missing routes.

## 2. Goals and non-goals

**Goals**
- Correct status codes for client errors; generic 500 body; details only in server logs.
- JSON 404 for unknown `/api/*`; SPA fallback only for non-API GETs.
- One helper for reading JSON bodies.

**Non-goals**
- Structured request tracing / APM.
- Changing response shapes that the frontend already depends on for *expected* errors (`{"errors": {...}}` for validation, `{"error": "..."}` for others).

## 3. Design

### 3.1 `app/errors.py`
`register_error_handlers(app)` registers, most specific first:

1. `RateLimitExceeded` (from [H4](h4-redis-rate-limiting.md)) → 429 JSON with `Retry-After`.
2. `werkzeug.exceptions.HTTPException`:
   - if `request.path.startswith("/api/")` → `jsonify({"error": e.description}), e.code`;
   - else if `e.code == 404` and the method is GET → `send_from_directory(static_folder, "index.html")` (status 200, SPA fallback);
   - else the default JSON error.
3. Catch-all `Exception` → `app.logger.exception("Unhandled error on %s %s", request.method, request.path)`; respond `{"error": "Internal server error"}`, 500. Never include `str(e)`.
4. Remove the nested handlers and `print` calls from `create_app`.
Flask-JWT-Extended's own handlers (401/422 for token problems) are registered for specific exception types and keep working; verify in tests.

### 3.2 `app/utils/http.py`
```python
def get_json_body(allow_list: bool = False):
    data = request.get_json(silent=True)
    if isinstance(data, dict) or (allow_list and isinstance(data, list)):
        return data
    raise BadRequest("A JSON object is required.")
```
Replace every `request.json`. `/tasks/bulk` uses `allow_list=True` and still validates the element types.

### 3.3 Route clean-up
Remove blanket `except Exception as e: return jsonify({... str(e)})` blocks. Keep only handlers that translate a *specific expected* error (for example `IntegrityError` on registration). Everything else falls through to the catch-all handler.

### 3.4 Logging
Configure `logging` once in `create_app` (stdout, level from `LOG_LEVEL`, default INFO, timestamp + level + message) so Cloud Run captures it. Replace `print` in `routes/`, `services/`, `main.py`, `mail_routes.py`.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- No stack traces, SQL or provider messages in responses.
- Logs must not include request bodies, passwords, tokens, emails or prompt text.
- 5xx responses from dependency failures (mailer, AI providers) use a fixed message per dependency (for example "Email service unavailable"), status 502/503.

## 6. Test plan

- `GET /api/does-not-exist` → 404 JSON; `GET /some/spa/path` → 200 `index.html`.
- `POST /api/tasks` with malformed JSON → 400; with a JSON list → 400; with `Content-Type: text/plain` → 400/415 (JSON, not 500).
- `PUT /api/tasks` (wrong method) → 405 JSON.
- Force an exception in a route (monkeypatch service to raise `RuntimeError("secret detail")`) → 500 body contains no "secret detail"; log contains it.
- Missing/invalid JWT still returns 401/422 as before.

## 7. Verification

Manual curl of each case above against a local run; confirm Cloud Run logs show tracebacks while clients see the generic message.

## 8. Dependencies

- Do early in Phase 1 so later specs get clean 400s. Tests rely on [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

None.
