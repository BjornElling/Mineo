import type { ISODateString } from '../types/branded';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;
export type DateInterval = Readonly<{ start: Date; end: Date }>;

export const validateIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): IsoRange | undefined => {
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

export function minISO(a: ISODateString, b: ISODateString): ISODateString;
export function minISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined;
export function minISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function maxISO(a: ISODateString, b: ISODateString): ISODateString;
export function maxISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined;
export function maxISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export const iterateDatesInclusive = (start: Date, end: Date, onDate: (date: Date) => void): void => {
  const current = new Date(start.getTime());
  while (current <= end) {
    onDate(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }
};

export const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};
