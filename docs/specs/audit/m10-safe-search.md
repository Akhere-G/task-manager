# M10: Safe full-text search

> **Severity:** Medium · **Category:** Bug · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed by code trace (syntax-error behaviour depends on MySQL boolean-mode parsing; reproduce in the test DB).
> **Depends on:** [M2](m2-error-handling.md), [M9](m9-list-endpoint-limits.md) (same builder file), [M12](m12-tests-and-ci.md).

## 1. Context and evidence

`task-manager-backend/app/utils/task_utils.py:23-28`:

```python
text("MATCH(title, description) AGAINST(:search IN BOOLEAN MODE)").bindparams(search=f"{search}*")
```

- The value is bound, so this is **not SQL injection**.
- But user text is interpreted as MySQL boolean-mode syntax: unbalanced `"` or `(`, stray `+`/`-`/`@`, `~`, `<`, `>` can raise a syntax error → 500.
- Only the last word receives the `*` wildcard.
- InnoDB ignores tokens shorter than `innodb_ft_min_token_size` (default 3), so searching "go" returns nothing.
- The frontend sends the search after a 400 ms debounce (`useTasks.ts:68-83`), so one malformed query is easy to hit while typing.

## 2. Goals and non-goals

**Goals**
- Any string typed in the search box yields results or an empty list, never an error.
- Short terms work.

**Non-goals**
- Ranking, stemming or typo tolerance.
- Replacing MySQL full text with an external search service.

## 3. Design

New `build_search_clause(search: str)` in `task_utils.py`, used by `build_task_filters`:

1. Normalise: strip, collapse whitespace, truncate to 100 characters.
2. Tokenise with a conservative regex (`[\w][\w'-]*` Unicode-aware); keep at most 8 tokens; if none remain, return no clause.
3. If **every** token has length ≥ 3: `MATCH(title, description) AGAINST(:q IN BOOLEAN MODE)` with `q = " ".join(f"+{tok}*" for tok in tokens)` (AND semantics, prefix match on each term). Tokens cannot contain operators because of step 2 (`'` and `-` inside words are stripped when they would act as operators; simplest is to remove them from the boolean query and keep them only in the LIKE path).
4. Otherwise (any token shorter than 3): fall back to `(title LIKE :p OR description LIKE :p)` for the whole normalised query, with `\`, `%` and `_` escaped (`ESCAPE '\\'`), `p = f"%{escaped}%"`.
5. The unqualified column names in the raw `text()` clause become `Task.title`/`Task.description` references where possible (use `func.match`-style construct or keep `text()` with the table name `tasks.title` to avoid ambiguity with joins).

Note for [M9](m9-list-endpoint-limits.md): the same function is used by `with_repeating`'s `additional_clauses`, so ghost search behaves identically.

## 4. Data and migration

None. The existing FULLTEXT index `idx_tasks_search` is reused. The LIKE path scans per user (bounded by `user_id` filter); acceptable for short queries.

## 5. Security and failure behaviour

- Still fully parameterised.
- Wildcard characters from the user are escaped in the LIKE path so `%` cannot be used to force expensive patterns.

## 6. Test plan (MySQL)

Table-driven test over inputs: `"foo (bar`, `"unclosed`, `+-*`, `@@@`, `()`, `~foo`, `<<>>`, `""`, `"go"`, `"%"`, `"a_b"`, a 500-character string, non-ASCII text. Each returns 200 with a list (no 500). Additional assertions:
- "report q3" finds a task titled "Q3 Report draft" (AND, prefix).
- "go" finds "Go gym" (LIKE path).
- "%" does not match everything.

## 7. Verification

Type `"` and `(` into the search box in the UI; the list updates (possibly empty) with no error banner.

## 8. Dependencies

- [M2](m2-error-handling.md), [M9](m9-list-endpoint-limits.md), [M12](m12-tests-and-ci.md).

## 9. Open questions and user-only actions

- Confirm the production `innodb_ft_min_token_size` (if lowered to 1-2, the LIKE fallback can be narrowed).
