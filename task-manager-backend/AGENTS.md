# Backend guidelines

Flask + SQLAlchemy 2.0 API for TaskFlow. These rules apply to all Python code in
`task-manager-backend/`.

## Layout

| Package         | Responsibility                                                            |
| --------------- | ------------------------------------------------------------------------- |
| `app/routes`    | HTTP only: read the request, call a service, return a response.           |
| `app/services`  | Business logic and database access.                                       |
| `app/schemas`   | Marshmallow validation and serialisation (camelCase on the wire).         |
| `app/models`    | SQLAlchemy models.                                                        |
| `app/utils`     | Small, framework-light helpers shared across layers (dates, recurrence…). |
| `app/exceptions.py` | `AppError` subclasses; `app/errors.py` turns them into responses.     |

Dependencies point downwards: routes → services → models/utils. Utils never import
routes or services.

## Code quality rules

1. **Readable control flow.** Use list/set/dict comprehensions only when they are
   simple (one loop, at most one short condition). Anything more complex is a plain
   `for` loop with `if` statements.
2. **Let the code speak.** Clear function, parameter and variable names replace
   comments. Functions and classes under 10 lines get no docstring or comments. On
   longer ones, write a comment only when it explains *why* or a non-obvious rule
   (e.g. a race condition, a database limitation), never to restate the name or the
   code. No section-banner comments. Prefer a better name or a type hint over a
   comment that explains a value.
3. **One word per concept.** Use the vocabulary below consistently across the backend.
   Do not introduce synonyms (`tz`/`timezone`/`zone`, `old`/`before`, `filters`/`clauses`).
4. **Functions do one thing.** Split a function when it validates *and* computes *and*
   persists, or when a block needs a comment to explain what it does — extract it into
   a well-named helper instead.
5. **Imports** are grouped and sorted the way ruff's isort rule (`I001`) expects:
   standard library, third party, then `app.*`, one blank line between groups. No
   unused imports. Import at module top level unless avoiding a circular import.
6. **Type hints** on every function signature (parameters and return). Use built-in
   generics and PEP 604 unions: `list[str]`, `dict[str, int]`, `tuple[str, str]`,
   `X | None`. Never `List`, `Dict`, `Tuple`, `Optional`, `Union`. Import abstract
   types (`Iterable`, `Iterator`, `Callable`) from `collections.abc`, not `typing`.
7. **Ruff clean.** Code must pass `ruff check` and `ruff format` with the config in
   `ruff.toml` (pycodestyle, pyflakes, isort, pyupgrade, bugbear, simplify). See
   <https://docs.astral.sh/ruff/rules/>.

## Conventions

- **Datetimes.** The database stores naive UTC datetimes. Use the helpers in
  `app/utils/dates.py` (`utc_now`, `as_naive_utc`, `as_aware_utc`, `to_iso_z`,
  `get_zone`) instead of calling `datetime.now(timezone.utc)` or `datetime.utcnow()`
  directly.
- **Queries.** SQLAlchemy 2.0 style only: `select(...)` with `db.session.scalar`,
  `scalars` or `execute`. No legacy `Model.query`. Every task query is scoped by
  `Task.user_id == user_id`.
- **Errors.** Raise an `AppError` subclass from `app/exceptions.py`; never build error
  JSON in a route. Add a new subclass rather than passing ad-hoc messages around.
- **Requests and responses.** Read bodies with `get_json_body()`, validate with a
  `CamelSchema` / `CamelAutoSchema`, and serialise through schemas or
  `format_json_response` so keys are camelCase and datetimes are ISO 8601 with `Z`.
- **Naming.** Private module helpers start with `_`. Module-level constants are
  `UPPER_SNAKE_CASE` and live at the top of the module (or in `app/constants.py` when
  shared).
- **Small modules.** Keep helpers next to the code that uses them; move them to
  `app/utils` only when two or more layers need them.

## Vocabulary

| Word            | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| task            | A row in `tasks`.                                                             |
| repeating task  | A task with `is_repeating`; it is the live head of its series.                |
| series          | A repeating task plus its completed history, linked by `series_id`.           |
| occurrence      | One instance of a repeating task, at a given start.                           |
| ghost           | An unsaved, projected future occurrence returned for calendar views.          |
| roll            | Completing an occurrence: save it as history and move the task to the next.   |
| `repeat_by`     | Frequency: `daily`, `weekly`, `monthly` or `yearly`.                          |
| `interval`      | "Every N" periods (`repeat_interval` on the model).                           |
| `days`          | The chosen days inside one period (`repeat_days` on the model).               |
| period          | The cycle the chosen days sit in: a week, month or year, named by its first day. |
| zone            | A `tzinfo`. Its IANA string is a `zone_name` (`repeat_timezone` column).      |
| start / end     | Datetimes. A calendar date is a `day`.                                        |
| view_start / view_end | The datetime range a calendar request covers.                          |
| before          | A detached copy of a task taken before an update.                             |
| clauses         | A list of SQLAlchemy `where` conditions.                                      |

## Commands

Run from `task-manager-backend/` with the virtualenv:

```bash
venv/bin/ruff check app tests
```

```bash
venv/bin/ruff format app tests
```

```bash
venv/bin/pytest
```

The test suite needs a local MySQL server (see `tests/conftest.py`). Add or update
tests alongside behaviour changes.
