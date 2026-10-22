# M14: AI provider reliability

> **Severity:** Medium · **Category:** Reliability · **Effort:** Small to Medium · **Status:** Specified, not implemented
> **Finding status:** Confirmed in code. Model names **unverified** (see pre-implementation check).
> **Depends on:** [H5](h5-ai-caps-and-quota.md) (timeouts/validation land first), [M2](m2-error-handling.md), [M12](m12-tests-and-ci.md). Related: [M13](m13-stats-performance.md).

## 1. Context and evidence

`task-manager-backend/app/services/ai_service.py`:
- `:30-56` `get_generated_text`: builds a new Gemini/Groq client on every call; bare `except Exception: pass` around Gemini (`:38-39`), so failures are invisible; the two providers get different system prompts (only Groq receives one, `:46-49`).
- `:131-142` `generate_daily_brief`: two concurrent first requests of the day both generate; the second insert violates `unique_user_day`, the broad `except` rolls back and returns the "wobble" text even though a brief now exists. The fallback text is returned with `success: true`.
- `:61` `date.today()` uses the **server's** date/time zone, not the user's; the task window and `generated_date` follow the server's day.
- `:104-109` and `:192` interpolate raw task titles/descriptions into prompts (prompt-injection surface; outputs are rendered with a restricted markdown allow-list on the frontend, so the impact is mostly nonsense output).
- Model names `gemini-3.5-flash` (`:34`) and `openai/gpt-oss-20b` (`:44`) are hardcoded. I could not verify that they exist in the providers' catalogues.

## 2. Goals and non-goals

**Goals**
- Provider failures are logged; fallbacks are honest; concurrency does not produce bogus errors.
- "Today" is the user's today.
- Models configurable without a code change.

**Non-goals**
- New providers or prompt redesign; streaming; retries with backoff beyond one provider fall-through.

## 3. Design

1. **Clients:** create the Gemini and Groq clients once at module level (lazy singletons keyed by API key). Timeouts per [H5](h5-ai-caps-and-quota.md).
2. **Config:** `GEMINI_MODEL`, `GROQ_MODEL` from env with the current values as defaults. **Pre-implementation check:** confirm both names in the providers' model lists (or via a one-off list-models call) and correct the defaults if needed.
3. **Logging:** `logger.warning("AI provider %s failed: %s", provider, type(exc).__name__)` for each failure (never the prompt or response text).
4. **System prompt:** one shared system prompt constant passed to both providers.
5. **Brief race:** wrap the insert in `try/except IntegrityError` → `db.session.rollback()` → re-read the stored brief and return it.
6. **Fallback honesty:** on total failure return `{"success": true, "brief": FALLBACK_TEXT, "fallback": true}` (not cached, as now). Frontend (`DailyBrief.tsx`) shows it with a small "try again" hint; no change for the normal path.
7. **User day:** the client appends `tz` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) to `GET /ai/daily-brief`. Server validates with `zoneinfo.ZoneInfo` (fallback `UTC`), computes the local date for `generated_date`, and converts the local day to UTC bounds for the task query. `build_task_filters` gets optional `start_dt`/`end_dt` datetime parameters (today it truncates to dates via `.date()`), and `get_all_tasks` passes them through.
8. **Prompt hygiene:** wrap user text in delimiters (for example triple quotes) and add an instruction to treat it as data, not instructions. Escape the delimiter in user text.

## 4. Data and migration

None (`daily_briefs.generated_date` already a DATE).

## 5. Security and failure behaviour

- `tz` is validated against the IANA list; unknown values fall back to UTC (no error).
- Logs include provider name and exception class only.

## 6. Test plan (providers mocked)

- Gemini fails, Groq succeeds → text from Groq and one warning logged.
- Both fail → `fallback: true`, nothing cached.
- Two concurrent brief generations → both return the same stored text, no bogus fallback.
- `tz=Pacific/Auckland` shifts the day boundary; invalid `tz` falls back to UTC.
- Prompt contains delimiter-escaped user text.

## 7. Verification

Staging: block Gemini credentials temporarily and confirm Groq serves briefs and logs show the failure.

## 8. Dependencies

- [H5](h5-ai-caps-and-quota.md), [M2](m2-error-handling.md), [M12](m12-tests-and-ci.md), [M13](m13-stats-performance.md).

## 9. Open questions and user-only actions

- **You:** confirm which model names you intend to use in production.
