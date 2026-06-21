// Delt commit-parse-kerne for HELTALS-inputs — brugt af BÅDE formularfeltet (`StyledIntegerField`)
// og tabel-cellen (`integerAdapter`). Tidligere var den identiske format-validering kopieret i begge
// familier med divergerende fejltekster ("Ugyldigt heltal" vs "Ugyldigt format"); A2 samler den her,
// med ÉN ensartet ordlyd.
//
// Kernen dækker KUN format-validering (fortegn, cifre, max-cifre, parse til tal). Interval-validering
// (min/max) holdes BEVIDST i de to wrappere, fordi de håndterer den forskelligt: formularen kan vise
// en ikke-blokerende UI-range-fejl (`enforceRange=false`), og tabellen viser den som visual-only fejl.
// Selve interval-BESKEDEN er allerede samlet i `getIntegerRangeErrorMessage`.

export type IntegerDraftParseConfig = Readonly<{
  allowNegative: boolean;
  /** Største antal cifre (ekskl. et valgfrit foranstillet `-`). Udeladt = ingen ciffergrænse i kernen. */
  maxDigits?: number;
}>;

export type IntegerDraftParseResult =
  | Readonly<{ ok: true; value: number | undefined }>
  | Readonly<{ ok: false; errorMessage: string }>;

/**
 * Format-parser et heltals-draft til commit. Tom (efter trim) → `value: undefined`.
 *
 * Bemærk: udfører IKKE interval-validering — kalderen anvender `getIntegerRangeErrorMessage` efter behov.
 */
export const parseIntegerDraftForCommit = (
  rawValue: string,
  { allowNegative, maxDigits }: IntegerDraftParseConfig
): IntegerDraftParseResult => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, value: undefined };

  if (!allowNegative && trimmed.startsWith('-')) {
    return { ok: false, errorMessage: 'Negative tal er ikke tilladt' };
  }

  const digitsOnly = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
  if (digitsOnly === '' || /[^0-9]/.test(digitsOnly)) {
    return { ok: false, errorMessage: 'Ugyldigt heltal' };
  }

  if (typeof maxDigits === 'number' && digitsOnly.length > maxDigits) {
    return { ok: false, errorMessage: `Maks ${maxDigits} cifre` };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, errorMessage: 'Ugyldigt heltal' };
  }

  return { ok: true, value: parsed };
};
