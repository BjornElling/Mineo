/**
 * Formatting og parsing utilities
 *
 * Centraliserede funktioner til formatering og parsing af tal, beløb og procenter.
 */

import type { AmountValue } from '../schemas/amountExpressionSchema';

/**
 * Parser procent-streng til decimal
 */
export const parsePercentToDecimal = (pct: string | number | undefined): number => {
  if (pct === undefined) return 0;
  if (typeof pct === 'number') return Number.isFinite(pct) ? pct / 100 : 0;
  if (!pct) return 0;
  const clean = pct.replace('%', '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num / 100;
};

/**
 * Parser beløb-streng til tal
 */
export const parseAmount = (val: string | number | AmountValue | undefined): number => {
  if (val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'object' && val !== null && 'kind' in val) {
    const value = (val as AmountValue).value;
    return Number.isFinite(value) ? value : 0;
  }
  if (!val) return 0;
  const clean = String(val).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

/**
 * Runder væk fra nul med angivet precision.
 */
export const roundHalfAwayFromZero = (value: number, precision: number): number => {
  const factor = 10 ** precision;
  return Math.sign(value) * Math.round(Math.abs(value) * factor) / factor;
};

/**
 * Formaterer tal til dansk valuta-format
 */
export const formatCurrency = (num: number | undefined | null): string => {
  if (num === null || num === undefined) return '';
  const rounded = Math.round(num * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split('.');
  const intWithSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intWithSeparators},${decPart}`;
};

/**
 * Formaterer tal til dansk beløbsformat med valgfri precision.
 */
export const formatAsAmount = (value: number | null | undefined, precision: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  const resolvedPrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : 2;
  const factor = 10 ** resolvedPrecision;
  const rounded = Math.round(value * factor) / factor;
  const isNegative = rounded < 0;
  const absoluteValue = Math.abs(rounded);

  const [integerPart, decimalPart = ''] = absoluteValue.toFixed(resolvedPrecision).split('.');
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (resolvedPrecision === 0) {
    return `${isNegative ? '-' : ''}${formatted}`;
  }
  return `${isNegative ? '-' : ''}${formatted},${decimalPart.padEnd(resolvedPrecision, '0')}`;
};

/**
 * Formaterer procent-tal til dansk format
 * Viser kun decimal hvis der faktisk er en decimal-del (ikke .0)
 */
export const formatPercent = (num: number): string => {
  if (num === null || num === undefined) return '';

  // Tjek om tallet har decimal-del (ikke kun .0)
  const hasDecimal = num % 1 !== 0;

  if (hasDecimal) {
    // Brug dansk komma-separator for decimal
    return `${num.toString().replace('.', ',')} %`;
  } else {
    // Vis kun heltal uden decimal
    return `${Math.floor(num)} %`;
  }
};
