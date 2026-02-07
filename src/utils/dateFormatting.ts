import type { ISODateString } from '../types/branded';
import { dateToISO, isISODateString } from '../types/branded';

export const MONTH_NAMES_DA = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
] as const;

export const MONTH_NAMES_DA_SHORT = [
  'jan.',
  'feb.',
  'mar.',
  'apr.',
  'maj',
  'jun.',
  'jul.',
  'aug.',
  'sep.',
  'okt.',
  'nov.',
  'dec.',
] as const;

export const formatIsoDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate || !isISODateString(isoDate)) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

export const formatIsoDateLong = (isoDate: ISODateString | undefined): string => {
  if (!isoDate || !isISODateString(isoDate)) return '';
  const [year, month, day] = isoDate.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10) - 1;
  if (!Number.isFinite(d) || !Number.isFinite(m)) return '';
  if (m < 0 || m >= MONTH_NAMES_DA.length) return '';
  return `${d}. ${MONTH_NAMES_DA[m]} ${year}`;
};

export const formatUtcDateShort = (date: Date | undefined): string => {
  const iso = dateToISO(date);
  return iso ? formatIsoDateShort(iso) : '';
};

export const formatUtcDateLong = (date: Date | undefined): string => {
  const iso = dateToISO(date);
  return iso ? formatIsoDateLong(iso) : '';
};
