# L6: Frontend code smells

> **Severity:** Low · **Category:** Maintainability / correctness · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed by reading; behavioural impact is minor.
> **Depends on:** [M12](m12-tests-and-ci.md) (React-hooks lint rule and Vitest), [M9](m9-list-endpoint-limits.md) (same hook, coordinate edits).

## 1. Context and evidence

- `task-manager-frontend/src/features/tasks/hooks/useTasks.ts`
  - `:68-83` the effect mutates the `searchParams` object returned by `useSearchParams` (`searchParams.set/delete`) before `setSearchParams`; dependency array is `[deferredSearch]` only (missing `searchParams`, `setSearchParams`).
  - `:146-150` `queryFn` calls `setSearchParams(params)` as a side effect when `currentPage > totalPages`, and `params` there is the *API* query (`q`, `start_date`, …), which **replaces** the page's URL params with API parameters.
  - `:33-42` `DEFAULT_FILTERS.currentDate = new Date().toISOString()` is evaluated once at module load, so it goes stale after midnight in a long-lived tab; `Settings.tsx:16` repeats the pattern.
  - `:159-175` `updateFilters` also mutates `searchParams` in place.
- `src/pages/Pomodoro.tsx` calls `navigate(-1)` during render when the task is completed (side effect in render).
- `src/pages/Settings.tsx:198-234` `FutureSections` is dead code (JSX built and discarded).
- `eslint.config.js` does not enable `eslint-plugin-react-hooks` although it is installed, so exhaustive-deps and rules-of-hooks are unchecked ([M12](m12-tests-and-ci.md)).

## 2. Goals and non-goals

**Goals**
- No in-place mutation of router state; no side effects in render or `queryFn`; lint enforces hooks rules.

**Non-goals**
- Redesigning the filter UI or switching state libraries.

## 3. Design

1. **`useTasks`**
   - Always copy before editing: `const next = new URLSearchParams(searchParams)`.
   - Remove `setSearchParams` from `queryFn`. After data arrives, a `useEffect` ([deps: `result.data`, `currentPage`]) clamps the page: if `data.currentPage > data.totalPages && data.totalPages > 0` then `setSearchParams(prev => { const n = new URLSearchParams(prev); n.set("page", String(data.totalPages)); return n; }, { replace: true })`.
   - Make `currentDate` lazy: `getDefaultFilters()` returns a fresh object; `Settings.tsx` uses it too. Keep `currentDate` in the query key only when the view needs it (calendar).
   - Complete effect dependencies (or use the functional `setSearchParams` form so they are stable).
2. **`Pomodoro.tsx`:** replace the render-time `navigate(-1)` with `if (isCompleted) return <Navigate to={-1 as unknown as string} replace />` (or an effect that navigates and returns `null`). Use the pattern already used elsewhere in the project if one exists.
3. **`Settings.tsx`:** delete `FutureSections` (record the idea in an issue).
4. **Lint:** enable the hooks plugin (already part of [M12](m12-tests-and-ci.md)); land at `warn`, fix all, raise to `error`.

## 4. Data and migration

None.

## 5. Security and failure behaviour

None; behaviour preserved except the page-clamp now keeps the other URL filters instead of replacing them with API params.

## 6. Test plan (Vitest + React Testing Library, or hook tests with `MemoryRouter`)

- Changing a filter does not mutate the previous `URLSearchParams` instance (snapshot identity check).
- Out-of-range `page` is corrected without dropping `category`/`q`.
- `getDefaultFilters()` returns a current date when called after faking the clock past midnight.
- Pomodoro with a completed task navigates back without a React warning ("cannot update during render").

## 7. Verification

Manual: open Home with `?page=99&category=work`; it lands on the last page and keeps the category. `npm run lint` passes with the hooks rules at `error`.

## 8. Dependencies

- [M12](m12-tests-and-ci.md), [M9](m9-list-endpoint-limits.md), [L8](l8-csv-formula-guard.md) (touches `Settings.tsx`).

## 9. Open questions and user-only actions

None.
