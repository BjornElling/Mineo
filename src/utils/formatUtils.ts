/**
 * Formatting utilities
 *
 * Centraliserede funktioner til formatering af tal, beløb og procenter.
 */

import { roundByMethod } from './rounding';
import { isWithinTolerance } from './numberComparison';

export const isSingularCount = (value: number): boolean => isWithinTolerance(value, 1);

export const formatCountWithUnit = (count: number, singular: string, plural: string): string =>
  `${formatAsAmountTrimmed(count, 2)} ${isSingularCount(count) ? singular : plural}`;

/**
 * Formaterer tal til dansk valuta-format
 */
export const formatCurrency = (num: number | undefined | null): string => {
  return formatAsAmount(num, 2);
};

export const formatKr = (value: number, precision: 0 | 2 = 0): string =>
  `${formatAsAmount(value, precision)} kr.`;

/**
 * Formaterer tal til dansk beløbsformat med valgfri precision.
 */
export const formatAsAmount = (value: number | null | undefined, precision: number = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  const resolvedPrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : 2;
  const rounded = roundByMethod(value, resolvedPrecision, 'halfAwayFromZero');
  const isNegative = rounded < 0;
  const absoluteValue = Math.abs(rounded);

  const [integerPart, decimalPart = ''] = absoluteValue.toFixed(resolvedPrecision).split('.');
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (resolvedPrecision === 0) {
    return `${isNegative ? '-' : ''}${formatted}`;
  }
  return `${isNegative ? '-' : ''}${formatted},${decimalPart.padEnd(resolvedPrecision, '0')}`;
};

export const formatAsAmountTrimmed = (value: number | null | undefined, precision: number = 2): string => {
  const formatted = formatAsAmount(value, precision);
  if (formatted === '' || !formatted.includes(',')) {
    return formatted;
  }
  return formatted.replace(/,?0+$/, '');
};

/**
 * Formaterer procent-tal til dansk format
 * VIGTIGT: Procent-format følger en bevidst anden visningsregel end formatAsAmount:
 * trailing .00/.0 fjernes for mere kompakt UI-visning (fx "10 %" i stedet for "10,00 %").
 */
export const formatPercent = (num: number): string => {
  if (num === null || num === undefined) return '';
  if (!Number.isFinite(num)) return '';

  const rounded = roundByMethod(num, 2, 'halfAwayFromZero');
  const formatted = rounded
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')
    .replace('.', ',');
  return `${formatted} %`;
};
