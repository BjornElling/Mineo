import { formatCurrency, isSingularCount } from '../formatUtils';

const NBSP = '\u00A0';

export const resolvePdfFileName = (baseTitle: string, isDraft: boolean, journalnr?: string): string => {
  const prefix = journalnr && journalnr.trim() !== '' ? `${journalnr.trim()} - ` : '';
  return `${prefix}${baseTitle}${isDraft ? ' (udkast)' : ''}.pdf`;
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

export const formatCurrencyFromOre = (ore: number): string => {
  if (!Number.isFinite(ore)) return '-';
  return formatCurrency(ore / 100);
};

export const formatMoneyOreWithKr = (ore: number): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

export const formatPercentDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export { isSingularCount } from '../formatUtils';

export const formatCountWithUnit = (count: number, singular: string, plural: string): string =>
  `${count.toLocaleString('da-DK')} ${isSingularCount(count) ? singular : plural}`;
