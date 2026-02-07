# Date Contract (Trust-Critical)

## Scope
- Any logic that counts calendar days or derives day-based periods.
- Any logic that computes interest days, svie/smerte days, TAF days, or period days.

## Rules
- All date-only `Date` instances MUST be treated as UTC calendar days.
  - Use `getUTC*` / `setUTC*` for all date component access.
  - Never rely on local time getters for date-only logic.
- Minimum time unit is days; hours/minutes/seconds are out of scope.
- All calendar day counts MUST use `src/utils/utcDayMath.ts`.
  - Inclusive counts: `countInclusiveUtcDays`
  - Exclusive counts: `countExclusiveUtcDays`
  - Raw diff: `diffUtcDays` / `diffUtcDaysAbs`
- ms-diff day counts are forbidden in business logic:
  - `(end.getTime() - start.getTime()) / 86400000` or variants
  - `Math.floor/ceil/round` on ms-diff for day counts
- Calendar iteration (day-by-day) is allowed ONLY when the domain needs per-day logic
  (e.g., holidays, weekdays, month fractions). It must be explicitly documented.

## Review Checklist
- Any new day count uses `utcDayMath`.
- If iteration is used, the function JSDoc must state inclusivity and why iteration is required.
- Sorting with `getTime()` is allowed only for ordering, never for day counts.
