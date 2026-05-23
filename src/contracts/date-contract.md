# Date Contract (Trust-Critical)

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt

## Scope
- Any logic that counts calendar days or derives day-based periods.
- Any logic that computes interest days, svie/smerte days, TAF days, or period days.
- Persisted/form layer owns `ISODateString`; this contract owns calendar math after the value is validated or normalized.

## Rules
- All date-only `Date` instances MUST be treated as UTC calendar days.
  - Use `getUTC*` / `setUTC*` for all date component access.
  - Never rely on local time getters for date-only logic.
- Minimum time unit is days; hours/minutes/seconds are out of scope.
- All calendar day counts MUST use `src/utils/utcDayMath.ts`.
  - Inclusive counts: `countInclusiveUtcDays`
  - Exclusive counts: `countExclusiveUtcDays`
  - Raw diff: `diffUtcDays` / `diffUtcDaysAbs`
- Local ms-diff day counts are forbidden in business logic:
  - `(end.getTime() - start.getTime()) / 86400000` on local/date-only instances or variants
  - `Math.floor/ceil/round` on local ms-diff for day counts
- UTC-normalized ms-diff inside `utcDayMath.ts` is allowed:
  - normalize with `Date.UTC(getUTCFullYear(), getUTCMonth(), getUTCDate())`
  - then divide by day milliseconds in the canonical helper only
- `countInclusiveUtcDays` and `countExclusiveUtcDays` return `null` when `start > end`.
  - Callers must handle `null` explicitly.
  - Non-null assertion is forbidden unless a nearby comment explains the proven invariant.
- Invalid `Date` / NaN input must not be accepted silently. Callers must validate before UTC day math, or helpers must fail-fast if they own the validation boundary.
- Calendar iteration (day-by-day) is allowed ONLY when the domain needs per-day logic
  (e.g., holidays, weekdays, month fractions). It must be explicitly documented.

## Date Pipeline

1. Form/persistence layer stores date-only values as `ISODateString`.
2. Parsing/coercion uses branded/date helpers in `src/types/branded.ts` and `src/domain/dates/isoDate.ts`.
3. Calculation layer may receive validated `ISODateString` or UTC-normalized date instances.
4. Day counts use `src/utils/utcDayMath.ts`.

## Review Checklist
- Any new day count uses `utcDayMath`.
- If iteration is used, the function JSDoc must state inclusivity (whether start and end day are both iterated) and why iteration is required.
- Sorting with `getTime()` is allowed only for ordering, never for day counts.
