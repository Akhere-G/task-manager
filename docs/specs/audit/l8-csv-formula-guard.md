# L8: CSV export formula-injection guard

> **Severity:** Low · **Category:** Security (client-side) · **Effort:** Small · **Status:** Specified, not implemented
> **Finding status:** Confirmed by reading the export code. Practical risk is low: exported data is the user's own, unless tasks arrive via CSV import or AI output.
> **Depends on:** [M12](m12-tests-and-ci.md) (Vitest), [M9](m9-list-endpoint-limits.md) (export paging, same file), [L6](l6-frontend-smells.md) (same file).

## 1. Context and evidence

`task-manager-frontend/src/pages/Settings.tsx:40-46`:

```ts
const escapeCSV = (value) => {
  const s = !value ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
```

It quotes for CSV syntax but does not neutralise cells that start with `=`, `+`, `-`, `@`, tab or carriage return. Opened in Excel/Sheets, a task titled `=HYPERLINK("http://…","click")` (or a longer formula) is evaluated. `category` and the date fields are written without any escaping (`:71-81`). `\r` is also not covered by the quoting regex.

Related: the import side (`BulkAddForm.tsx`) uses `papaparse` and the same data can round-trip, so a malicious CSV can become a stored task that later exports as a formula.

## 2. Goals and non-goals

**Goals**
- Exported CSV cells from user text can never be interpreted as formulas.
- Correct CSV quoting for all special characters.

**Non-goals**
- Changing the import format; stripping characters from stored titles.

## 3. Design

New `src/utils/csv.ts`:

```ts
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(s)) s = "'" + s;            // OWASP-recommended guard
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export const toCsv = (rows: unknown[][]) => rows.map(r => r.map(csvCell).join(",")).join("\n");
```

- `Settings.tsx` uses `toCsv` for the export; every column goes through `csvCell` (title, category, description, dates, booleans).
- `BulkAddForm.tsx` template download uses the same helper.
- Numbers such as negative durations are not exported, so the leading `-` rule cannot corrupt legitimate data; dates are ISO strings starting with a digit.

## 4. Data and migration

None.

## 5. Security and failure behaviour

- The leading apostrophe is visible in some spreadsheet apps; acceptable and standard.
- Round-trip: the import trims whitespace only; a leading `'` would be imported as part of the title. Optional follow-up: strip a single leading `'` on import when the next character is a formula trigger.

## 6. Test plan (Vitest)

`csvCell` table: `=1+1` → `'=1+1`; `+SUM(A1)`, `-2`, `@cmd`, tab and CR prefixes guarded; `a,b` quoted; embedded quotes doubled; embedded newline quoted; `null`/`undefined` → empty; normal text unchanged.
`toCsv` round-trips through `papaparse` for non-formula data.

## 7. Verification

Export a task titled `=HYPERLINK("http://example.com","x")` and open the file in a spreadsheet: shows literal text, not a link.

## 8. Dependencies

- [M12](m12-tests-and-ci.md), [M9](m9-list-endpoint-limits.md), [L6](l6-frontend-smells.md).

## 9. Open questions and user-only actions

None.
