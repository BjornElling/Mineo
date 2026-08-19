// Delt commit-parse-kerne for UGE-inputs (uge/år-par) – brugt af BÅDE formularfeltet (`WeekField`)
// og tabel-cellen (`weekAdapter`). Tidligere var den identiske uge-/år-parsing kopieret i begge familier;
// A2 samler den her. Årsdelens fortolkning og interval-besked deles yderligere med årstalsfeltet via
// `yearDraftCore` (ensartet ordlyd: "Årstallet skal være …").

import { yearHas53Weeks } from './dateUtils';
import { normalizeWeekSeparators } from './numericDraftAdmission';
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

/**
 * HVORFOR et ugedraft blev afvist – maskinlæsbart, så en LÆSER kan skelne uden at matche på beskedteksten.
 *
 * - `malformed` – teksten er ikke et uge/år-par (forkert længde, ikke-cifre, manglende del). Beskeden kan
 *   ikke sige mere end feltets navn.
 * - `weekNumber` – uge/år-parret er velformet, men ugenummeret findes ikke i det år («Uge skal være mellem
 *   1 og 53»). Her ER der en konkret rettelse at vise brugeren.
 *
 * Skellet er en TYPE og ikke en strengsammenligning, fordi `error-contract.md` §4 udtrykkeligt forbyder
 * skaller at udlede issue-klassen af beskedteksten – det er præcis den drift, `detail`-nøglen findes for.
 */
export type WeekDraftInvalidKind = 'malformed' | 'weekNumber';

export type WeekDraftParseResult =
  | Readonly<{ ok: true; value: string | undefined }>
  | Readonly<{ ok: false; invalidKind: WeekDraftInvalidKind; errorMessage: string }>;

const fail = (errorMessage: string, invalidKind: WeekDraftInvalidKind = 'malformed'): WeekDraftParseResult => ({
  ok: false,
  invalidKind,
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

  // Separatorsættet ejes af `normalizeWeekSeparators`, som feltets tegnværn læser af samme kilde.
  // Her stod før et selvstændigt `[ .:-]`, der hverken dækkede `,` og `\` (tastbare, men afvist ved
  // settle) eller udelod mellemrummet (ikke længere en separator, jf. brugerbeslutning 2026-08-18).
  const normalized = normalizeWeekSeparators(trimmed);
  if (normalized.startsWith('/')) return fail('Ugyldigt format');

  const [weekRaw = '', yearRaw = '', ...rest] = normalized.split('/');
  if (rest.length > 0) return fail('Ugyldigt format');
  if (weekRaw === '' || yearRaw === '') return fail('Ugyldigt format');
  if (/[^0-9]/.test(weekRaw) || /[^0-9]/.test(yearRaw)) return fail('Ugyldigt format');
  if (weekRaw.length > 2) return fail('Ugyldigt format');

  const weekNum = Number.parseInt(weekRaw, 10);
  // Ugenummeret vurderes før årstallet er kendt, så den øvre grænse (52/53) kan ikke nævnes her. Den nedre
  // kan, og «Ugyldig uge» sagde reelt kun det, feltnavnet allerede siger.
  if (!Number.isFinite(weekNum) || weekNum < 1) return fail('Uge skal være mindst 1', 'weekNumber');

  const year = resolveYearFromToken(yearRaw, twoDigitYearPolicy);
  if (year === null) return fail('Ugyldigt årstal');

  const rangeError = getYearRangeErrorMessage(year, minYear, maxYear);
  if (rangeError !== '') return fail(rangeError);

  const maxWeek = yearHas53Weeks(year) ? 53 : 52;
  if (weekNum > maxWeek) return fail(`Uge skal være mellem 1 og ${maxWeek}`, 'weekNumber');

  return { ok: true, value: `${String(weekNum).padStart(2, '0')}/${String(year)}` };
};
