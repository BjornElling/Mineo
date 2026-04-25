import type { DanishDateString, ISODateString } from '../types/branded';
import { dateToISO, isISODateString, isoToDanish, toDanishDateString } from '../types/branded';

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

export const WEEKDAY_NAMES_DA = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
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

export const formatUtcTimestampSeconds = (date: Date): string => {
  const iso = formatToISO(date);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${iso} ${hours}:${minutes}:${seconds}`;
};

export const formatISOToDanish = (isoDate: string): string => {
  const danish = isoToDanish(isISODateString(isoDate) ? isoDate : undefined);
  return danish ?? '';
};

export const formatDanishDate = (date: Date): DanishDateString => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date passed to formatDanishDate.');
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return toDanishDateString(`${day}-${month}-${year}`);
};

export const formatToISO = (date: Date): ISODateString => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date passed to formatToISO.');
  }

  const iso = dateToISO(date);
  if (!iso) {
    throw new Error('Could not convert Date to ISODateString.');
  }

  return iso;
};
