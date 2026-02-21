import { formatCurrency } from '../formatUtils';
import { roundByMethod } from '../rounding';

const NBSP = '\u00A0';

export const resolvePdfFileName = (baseTitle: string, isDraft: boolean, journalnr?: string): string => {
  const prefix = journalnr && journalnr.trim() !== '' ? `${journalnr.trim()} - ` : '';
  return `${prefix}${baseTitle}${isDraft ? ' (udkast)' : ''}.pdf`;
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const rounded = roundByMethod(value, 4, 'halfAwayFromZero');
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

export const formatCurrencyFromOre = (ore: number): string => {
  if (!Number.isFinite(ore)) return '-';
  return formatCurrency(ore / 100);
};

export const formatMoneyOreWithKr = (ore: number): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

export const formatCurrencyPerUnit = (amount: number | null | undefined, unit: string): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return `${formatCurrency(amount)}${NBSP}kr./${unit}`;
};

export const formatPercentDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const rounded = roundByMethod(abs, 2, 'halfAwayFromZero');
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export { isSingularCount } from '../formatUtils';
export { formatCountWithUnit } from '../formatUtils';
