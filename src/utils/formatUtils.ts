/**
 * Formatting utilities
 *
 * Centraliserede funktioner til formatering af tal, beløb og procenter.
 */

import { roundByMethod } from './rounding';
const SINGULAR_EPSILON = 0.0000001;

export const isSingularCount = (value: number): boolean => Math.abs(value - 1) < SINGULAR_EPSILON;

export const formatCountWithUnit = (count: number, singular: string, plural: string): string =>
  `${count.toLocaleString('da-DK')} ${isSingularCount(count) ? singular : plural}`;

/**
 * Formaterer tal til dansk valuta-format
 */
export const formatCurrency = (num: number | undefined | null): string => {
  if (num === null || num === undefined) return '';
  const rounded = roundByMethod(num, 2, 'halfAwayFromZero');
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

/**
 * Formaterer procent-tal til dansk format
 * Viser kun decimal hvis der faktisk er en decimal-del (ikke .0)
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
