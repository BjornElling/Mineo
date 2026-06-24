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
  | Readonly<{ ok: false; errorMessage: string }>;

const fail = (errorMessage: string): WeekDraftParseResult => ({
  ok: false,
  errorMessage,
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
  if (trimmed.length > maxDraftLength) return fail('Ugyldigt format');

  const normalized = trimmed.replace(/[ .:-]/g, '/');
  if (normalized.startsWith('/')) return fail('Ugyldigt format');

  const [weekRaw = '', yearRaw = '', ...rest] = normalized.split('/');
  if (rest.length > 0) return fail('Ugyldigt format');
  if (weekRaw === '' || yearRaw === '') return fail('Ugyldigt format');
  if (/[^0-9]/.test(weekRaw) || /[^0-9]/.test(yearRaw)) return fail('Ugyldigt format');
  if (weekRaw.length > 2) return fail('Ugyldigt format');

  const weekNum = Number.parseInt(weekRaw, 10);
  if (!Number.isFinite(weekNum) || weekNum < 1) return fail('Ugyldig uge');

  const year = resolveYearFromToken(yearRaw, twoDigitYearPolicy);
  if (year === null) return fail('Ugyldigt årstal');

  const rangeError = getYearRangeErrorMessage(year, minYear, maxYear);
  if (rangeError !== '') return fail(rangeError);

  const maxWeek = yearHas53Weeks(year) ? 53 : 52;
  if (weekNum > maxWeek) return fail(`Uge skal være mellem 1 og ${maxWeek}`);

  return { ok: true, value: `${String(weekNum).padStart(2, '0')}/${String(year)}` };
};
