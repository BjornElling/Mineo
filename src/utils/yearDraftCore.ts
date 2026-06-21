// Delt commit-parse-kerne for ÅRSTALS-inputs — brugt af BÅDE formularfeltet (`StyledYearField`) og
// tabel-cellen (`yearAdapter`), samt af uge-kernen (`weekDraftCore`) til at fortolke årsdelen. Tidligere
// var den identiske 2-/4-cifret-fortolkning og interval-besked kopieret i fire familier med divergerende
// ordlyd ("Ugyldigt format" vs "Ugyldigt årstal"; "År skal være …" vs "Årstallet skal være …"). A2 samler
// det her med ÉN ensartet ordlyd.

import { interpretYear } from './dateInputValidation';

export type TwoDigitYearPolicy = 'reject' | 'infer' | 'assume20xx';

export type YearDraftParseConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TwoDigitYearPolicy;
}>;

export type YearDraftParseResult =
  | Readonly<{ ok: true; value: number | undefined }>
  | Readonly<{ ok: false; errorMessage: string }>;

/**
 * Ensartet interval-fejlbesked for et årstal. Tom streng = inden for interval.
 *
 * Bruges af både årstals- og ugefelter (form + tabel), så et år-uden-for-interval læser ens overalt.
 */
export const getYearRangeErrorMessage = (
  year: number,
  minYear: number | undefined,
  maxYear: number | undefined
): string => {
  if (typeof minYear === 'number' && year < minYear) {
    if (typeof maxYear === 'number') {
      if (minYear === maxYear) return `Årstallet skal være ${minYear}`;
      return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
    }
    return `Årstallet skal være ${minYear} eller senere`;
  }
  if (typeof maxYear === 'number' && year > maxYear) {
    if (typeof minYear === 'number') {
      if (minYear === maxYear) return `Årstallet skal være ${maxYear}`;
      return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
    }
    return `Årstallet skal være ${maxYear} eller tidligere`;
  }
  return '';
};

/**
 * Fortolker et ciffer-token til et 4-cifret årstal efter 2-cifret-politikken.
 * Returnerer `null` for alt der ikke er et entydigt årstal (forkert længde, ikke-tal, afvist 2-cifret).
 *
 * `token` forventes at være trimmet og kun-cifre; kalderen håndterer tom/ikke-numerisk og partial-typing.
 */
export const resolveYearFromToken = (token: string, policy: TwoDigitYearPolicy): number | null => {
  if (token.length === 4) {
    const parsed = Number.parseInt(token, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (token.length === 1 || token.length === 2) {
    if (policy === 'reject') return null;
    if (policy === 'assume20xx') {
      const parsed = Number.parseInt(token, 10);
      return Number.isFinite(parsed) ? 2000 + parsed : null;
    }
    return interpretYear(token);
  }
  return null;
};

/**
 * Format- + interval-parser et årstals-draft til commit. Tom (efter trim) → `value: undefined`.
 * Alle format-fejl giver beskeden "Ugyldigt årstal"; interval-fejl bruger `getYearRangeErrorMessage`.
 */
export const parseYearDraftForCommit = (
  rawValue: string,
  { minYear, maxYear, twoDigitYearPolicy }: YearDraftParseConfig
): YearDraftParseResult => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (/[^0-9]/.test(trimmed)) return { ok: false, errorMessage: 'Ugyldigt årstal' };

  const year = resolveYearFromToken(trimmed, twoDigitYearPolicy);
  if (year === null) return { ok: false, errorMessage: 'Ugyldigt årstal' };

  const rangeError = getYearRangeErrorMessage(year, minYear, maxYear);
  if (rangeError !== '') return { ok: false, errorMessage: rangeError };

  return { ok: true, value: year };
};
