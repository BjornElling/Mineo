import type { DanishDateString, ISODateString } from '../types/branded';
import { dateToISO, isISODateString, isoToDanish, toDanishDateString, toISODateString } from '../types/branded';

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
  return iso ? formatISOToDanish(iso) : '';
};

export const formatUtcDateLong = (date: Date | undefined): string => {
  const iso = dateToISO(date);
  return iso ? formatIsoDateLong(iso) : '';
};

/**
 * Dansk tidszone. ALT brugersynligt/udvikler-rettet tids-output (fejlrapport,
 * DevTools-notits, filnavne, email-emne) formateres i denne zone – uafhængigt
 * af UTC-lagringen og af hvilken tidszone brugerens maskine er sat til.
 */
export const COPENHAGEN_TIME_ZONE = 'Europe/Copenhagen' as const;

// formatToParts giver tidskomponenter i Europe/Copenhagen (håndterer sommertid).
// h23 sikrer "00".."23" (undgår "24" ved midnat i visse runtimes).
const copenhagenPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: COPENHAGEN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getCopenhagenParts = (date: Date): Record<string, string> => {
  const parts = copenhagenPartsFormatter.formatToParts(date);
  const out: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  return out;
};

/**
 * Formaterer et instant til dansk tidszone som "ÅÅÅÅ-MM-DD TT:MM:SS".
 * Bruges til fejlrapportens hændelses-tidsstempler, så udvikleren ser
 * brugerens danske klokkeslæt – ikke UTC.
 */
export const formatCopenhagenTimestampSeconds = (date: Date): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date passed to formatCopenhagenTimestampSeconds.');
  }
  const p = getCopenhagenParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

/**
 * Dags-dato for et instant i dansk tidszone som ISODateString ("ÅÅÅÅ-MM-DD").
 * Bruges til fejlrapportens filnavne og email-emne, så datoen er konsistent
 * med rapportens danske tidsstempler.
 */
export const formatCopenhagenISODate = (date: Date): ISODateString => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date passed to formatCopenhagenISODate.');
  }
  const p = getCopenhagenParts(date);
  return toISODateString(`${p.year}-${p.month}-${p.day}`);
};

export const formatISOToDanish = (isoDate: string | undefined): string => {
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
