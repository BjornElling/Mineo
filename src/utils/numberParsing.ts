import type { AmountValue } from '../schemas/amountExpressionSchema';

/**
 * Parser procent-streng til decimal.
 *
 * Accepterer både normaliserede og dansk-formaterede talstrenge:
 * - "12,5%" -> 0.125
 * - "1.234,56 %" -> 12.3456
 */
export const parsePercentToDecimal = (pct: string | number | undefined): number => {
  if (pct === undefined) return 0;
  if (typeof pct === 'number') return Number.isFinite(pct) ? pct / 100 : 0;
  if (!pct) return 0;
  const withoutPercent = pct.replaceAll('%', '').replace(/\s+/g, '').trim();
  if (!withoutPercent) return 0;

  const commaIdx = withoutPercent.lastIndexOf(',');
  const dotIdx = withoutPercent.lastIndexOf('.');

  let normalized = withoutPercent;
  if (commaIdx >= 0 && dotIdx >= 0) {
    // Brug sidste separator som decimaltegn; fjern den anden som tusindtalsseparator.
    if (commaIdx > dotIdx) {
      normalized = withoutPercent.replaceAll('.', '').replace(',', '.');
    } else {
      normalized = withoutPercent.replaceAll(',', '');
    }
  } else if (commaIdx >= 0) {
    normalized = withoutPercent.replace(',', '.');
  }

  const num = Number.parseFloat(normalized);
  return Number.isNaN(num) ? 0 : num / 100;
};

/**
 * Parser numerisk beløbsværdi til tal.
 */
export const parseAmount = (val: number | AmountValue | undefined): number => {
  if (val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'object' && val !== null && 'kind' in val) {
    const value = val.value;
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
};
