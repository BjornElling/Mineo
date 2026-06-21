// Delt commit-parse-kerne for UGE-inputs (uge/år-par) — brugt af BÅDE formularfeltet (`StyledWeekField`)
// og tabel-cellen (`weekAdapter`). Tidligere var den identiske uge-/år-parsing kopieret i begge familier;
// A2 samler den her. Årsdelens fortolkning og interval-besked deles yderligere med årstalsfeltet via
// `yearDraftCore` (ensartet ordlyd: "Årstallet skal være …").

import { yearHas53Weeks } from './dateUtils';
import { getYearRangeErrorMessage, resolveYearFromToken, type TwoDigitYearPolicy } from './yearDraftCore';

export type WeekDraftParseConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TwoDigitYearPolicy;
  /**
   * Største antal draft-tegn (efter trim) før "Ugyldigt format". Formularen og tabel-cellen bruger
   * bevidst hver sin tolerance (9 hhv. 8), så grænsen er en eksplicit parameter frem for en konstant.
   */
  maxDraftLength: number;
}>;

export type WeekDraftParseResult =
  | Readonly<{ ok: true; value: string | undefined }>
  // `partialEligible`: under typing skal denne fejl vises som "endnu ikke færdig" (ingen rød fejl),
  // i modsætning til en endelig semantisk fejl (uge/år uden for interval). Single source for partial-
  // klassifikationen, så formular og tabel ikke divergerer.
  | Readonly<{ ok: false; errorMessage: string; partialEligible: boolean }>;

const fail = (errorMessage: string, partialEligible: boolean): WeekDraftParseResult => ({
  ok: false,
  errorMessage,
  partialEligible,
});

/**
 * Format- + interval-parser et uge-draft til commit. Tom (efter trim) → `value: undefined`.
 * Kanonisk form ved succes: `"UU/ÅÅÅÅ"` (uge nul-polstret til to cifre).
 */
export const parseWeekDraftForCommit = (
  rawValue: string,
  { minYear, maxYear, twoDigitYearPolicy, maxDraftLength }: WeekDraftParseConfig
): WeekDraftParseResult => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (trimmed.length > maxDraftLength) return fail('Ugyldigt format', true);

  const normalized = trimmed.replace(/[ .:-]/g, '/');
  if (normalized.startsWith('/')) return fail('Ugyldigt format', true);

  const [weekRaw = '', yearRaw = '', ...rest] = normalized.split('/');
  if (rest.length > 0) return fail('Ugyldigt format', true);
  if (weekRaw === '' || yearRaw === '') return fail('Ugyldigt format', true);
  if (/[^0-9]/.test(weekRaw) || /[^0-9]/.test(yearRaw)) return fail('Ugyldigt format', true);
  if (weekRaw.length > 2) return fail('Ugyldigt format', true);

  const weekNum = Number.parseInt(weekRaw, 10);
  if (!Number.isFinite(weekNum) || weekNum < 1) return fail('Ugyldig uge', false);

  const year = resolveYearFromToken(yearRaw, twoDigitYearPolicy);
  if (year === null) return fail('Ugyldigt årstal', true);

  const rangeError = getYearRangeErrorMessage(year, minYear, maxYear);
  if (rangeError !== '') return fail(rangeError, false);

  const maxWeek = yearHas53Weeks(year) ? 53 : 52;
  if (weekNum > maxWeek) return fail(`Uge skal være mellem 1 og ${maxWeek}`, false);

  return { ok: true, value: `${String(weekNum).padStart(2, '0')}/${String(year)}` };
};
