import type { AmountValue } from '../schemas/amountExpressionSchema';

export const parseDanishNumberString = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(trimmed)) return undefined;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Kanonisk parsing af et procent-felt til PROCENTPOINT (fx "12,5 %" -> 12.5).
 *
 * Én fælles locale-politik (dansk): komma er decimaltegn, punktum er tusindtalsseparator.
 * Et tal med punktum som decimaltegn ("12.5") afvises derfor (-> undefined), så samme
 * input aldrig kan give forskellige resultater afhængigt af kaldssted. Tal-input
 * returneres uændret. Tom/ugyldig -> undefined.
 */
export const parsePercentPointString = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const withoutPercent = value.replace('%', '').trim();
  return parseDanishNumberString(withoutPercent);
};

/**
 * Parser et procent-felt til DECIMAL (fx "12,5 %" -> 0.125).
 *
 * Tynd projektion af {@link parsePercentPointString} (pct-point / 100), så hele
 * programmet deler ÉN locale-politik for procent-parsing. Ugyldigt/tomt -> 0.
 */
export const parsePercentToDecimal = (pct: string | number | undefined): number => {
  const pctPoint = parsePercentPointString(pct);
  return pctPoint === undefined ? 0 : pctPoint / 100;
};

/**
 * Parser numerisk beløbsværdi til tal.
 */
export const parseAmount = (val: number | AmountValue | undefined): number => {
  if (val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'object' && val !== null && 'kind' in val) {
    const value = val.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return 0;
};

export const parseOptionalIntegerFromString = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};
