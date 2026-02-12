const SINGULAR_EPSILON = 0.0000001;

export const resolvePdfFileName = (baseTitle: string, isDraft: boolean, journalnr?: string): string => {
  const prefix = journalnr && journalnr.trim() !== '' ? `${journalnr.trim()} - ` : '';
  return `${prefix}${baseTitle}${isDraft ? ' (udkast)' : ''}.pdf`;
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

export const isSingularCount = (value: number): boolean => Math.abs(value - 1) < SINGULAR_EPSILON;

export const formatCountWithUnit = (count: number, singular: string, plural: string): string =>
  `${count.toLocaleString('da-DK')} ${isSingularCount(count) ? singular : plural}`;
