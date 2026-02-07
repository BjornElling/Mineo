import type { TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isISODateString, subtractOneDay } from '../../types/branded';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

export type TafConstraintSource = Readonly<{
  vedroererPeriodeFra?: ISODateString | string | undefined;
  vedroererPeriodeTil?: ISODateString | string | undefined;
  differencekravDato?: ISODateString | string | undefined;
  endeligtEetAfgorelse?: 'Ja' | 'Nej' | undefined;
  endeligEETVirkningsdato?: ISODateString | string | undefined;
  endeligEETAfgoerelseDato?: ISODateString | string | undefined;
  verserendeKlageEet?: 'Ja' | 'Nej' | undefined;
}>;

export type TafConstraintBounds = Readonly<{
  minStart?: ISODateString;
  maxEnd?: ISODateString;
}>;

const minIso = (a: ISODateString, b: ISODateString): ISODateString => (a < b ? a : b);
const maxIso = (a: ISODateString, b: ISODateString): ISODateString => (a > b ? a : b);

const minDefined = (...values: Array<ISODateString | undefined>): ISODateString | undefined => {
  let current: ISODateString | undefined = undefined;
  for (const value of values) {
    if (!value) continue;
    if (!current || value < current) current = value;
  }
  return current;
};

const resolveIso = (value: unknown): ISODateString | undefined =>
  typeof value === 'string' && isISODateString(value) ? value : undefined;

const resolveEndeligEetDato = (values: TafConstraintSource): ISODateString | undefined => {
  if (values.endeligtEetAfgorelse !== 'Ja') return undefined;
  return resolveIso(values.endeligEETVirkningsdato) ?? resolveIso(values.endeligEETAfgoerelseDato);
};

export const resolveTafConstraintBounds = (values: TafConstraintSource): TafConstraintBounds => {
  const minStart = resolveIso(values.vedroererPeriodeFra);
  const erstatningsTil = resolveIso(values.vedroererPeriodeTil);

  const differencekravDato = resolveIso(values.differencekravDato);
  const differencekravMax = subtractOneDay(differencekravDato);

  const endeligEetDato = resolveEndeligEetDato(values);
  const endeligEetMax = values.verserendeKlageEet === 'Ja' ? undefined : subtractOneDay(endeligEetDato);

  const maxEnd = minDefined(erstatningsTil, differencekravMax, endeligEetMax);

  return { minStart, maxEnd };
};

export const clampTafRange = (range: IsoRange, bounds: TafConstraintBounds): IsoRange | null => {
  let fra = range.fra;
  let til = range.til;

  if (bounds.minStart) {
    fra = maxIso(fra, bounds.minStart);
  }

  if (bounds.maxEnd) {
    til = minIso(til, bounds.maxEnd);
  }

  if (fra > til) return null;

  return { fra, til };
};

export const getValidTafRange = (row: Readonly<{ fra?: string | undefined; til?: string | undefined }>): IsoRange | null => {
  if (!isISODateString(row.fra) || !isISODateString(row.til)) return null;
  if (row.fra > row.til) return null;
  return { fra: row.fra, til: row.til };
};

export const clampTafRow = (row: Readonly<{ fra?: string | undefined; til?: string | undefined }>, bounds: TafConstraintBounds): IsoRange | null => {
  const range = getValidTafRange(row);
  if (!range) return null;
  return clampTafRange(range, bounds);
};

export const buildClampedTafRanges = (rows: readonly TafPeriodeRow[], bounds: TafConstraintBounds): IsoRange[] => {
  const ranges: IsoRange[] = [];
  for (const row of rows) {
    const clamped = clampTafRow(row, bounds);
    if (clamped) ranges.push(clamped);
  }
  return ranges;
};
