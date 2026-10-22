# L2: Contact form email hardening

> **Severity:** Low · **Category:** Security / robustness · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed.
> **Depends on:** [H4](h4-redis-rate-limiting.md) (rate limit on this route), [M2](m2-error-handling.md) (JSON body helper, error shape).

## 1. Context and evidence

`task-manager-backend/app/routes/mail_routes.py`:
- `:18-23` `send_enquiry_email` interpolates `full_name`, `email`, `subject`, `message` into an HTML email **without escaping** (including a `mailto:` link built from `email`).
- `:60-67` the visitor's name is used as the **sender display name** (`from_email(from_email, full_name)`), and the visitor's email is not used as reply-to.
- `:53` recipient comes from `MAIL_USERNAME`, which is not in `.env.example`.
- `:71-74` failure is printed, and returned as 400 (it is a server/provider failure).
- `app/utils/validators.py:136-155` (`validate_contact_request`) calls `.get(...).strip()` on values that may not be strings, and on `data` that may be `None` → `AttributeError` → 500. The email regex is permissive and there is no overall length limit on the email.
- Route is unauthenticated.

**Impact:** HTML/link injection into the owner's inbox (phishing-style content), spoofable-looking sender name, crashes on malformed bodies, noisy failures.

## 2. Goals and non-goals

**Goals**
- Safe HTML, correct headers, clear failure semantics.

**Non-goals**
- CAPTCHA (rate limiting in [H4](h4-redis-rate-limiting.md) is the abuse control); changing the form UI.

## 3. Design

1. **Escape:** `html.escape(value, quote=True)` for all four fields before interpolation; build the `mailto:` link from the escaped email only after validation; keep `white-space: pre-wrap` for the message.
2. **Validation:** use `get_json_body()` ([M2](m2-error-handling.md)); require each field to be `str` before `.strip()`; `email` length ≤ 254 and a stricter pattern (no spaces, one `@`, at least one dot in the domain); reject control characters (`\r`, `\n`) in `fullName`, `subject` and `email`; keep existing length limits (name ≤ 100, subject ≤ 100, message 10-2000).
3. **Headers:** send from the configured sender address with a **fixed** display name (for example "TaskFlow Contact Form"), set `reply_to` to the visitor's email and name; subject prefixed `"[Contact] "`.
4. **Config:** rename the recipient setting to `CONTACT_TO_EMAIL`, falling back to `MAIL_USERNAME` for one release; add both to `.env.example`; if neither is set, fail fast at startup only when the contact route is enabled (log warning otherwise and return 503 from the route).
5. **Errors:** log failures with `logging` (no message body); return `502 {"message": "Enquiry could not be sent"}` for mailer failures (400 stays for validation).
6. Check the MailerSend SDK call for a `reply_to` builder method before coding (SDK `mailersend==2.0.0`).

## 4. Data and migration

None.

## 5. Security and failure behaviour

- No visitor-controlled value reaches headers unescaped or with CR/LF.
- Rate limited by IP ([H4](h4-redis-rate-limiting.md)): 3 per hour.

## 6. Test plan (MailerSend mocked)

- `message="<script>alert(1)</script>"` appears escaped in the built HTML.
- Newline in `fullName`/`subject` → 400.
- Non-string field, JSON list, missing body → 400 (not 500).
- Mailer exception → 502, nothing sensitive logged.
- Built email has fixed sender name and reply-to set to the visitor.

## 7. Verification

Send a test enquiry containing HTML and a long line; open the received email and confirm literal text.

## 8. Dependencies

- [H4](h4-redis-rate-limiting.md), [M2](m2-error-handling.md), [L4](l4-analytics-and-docs.md) (`.env.example`).

## 9. Open questions and user-only actions

- **You:** which address should receive enquiries (value for `CONTACT_TO_EMAIL`).
