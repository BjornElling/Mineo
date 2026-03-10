import type { TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isISODateString, subtractOneDay } from '../../types/branded';
import { minISO, maxISO } from '../../utils/isoDateHelpers';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

export type TafConstraintSource = Readonly<{
  vedroererPeriodeFra?: ISODateString | undefined;
  vedroererPeriodeTil?: ISODateString | undefined;
  differencekravDato?: ISODateString | undefined;
  endeligtEetAfgorelse?: 'Ja' | 'Nej' | undefined;
  endeligEETVirkningsdato?: ISODateString | undefined;
  endeligEETAfgoerelseDato?: ISODateString | undefined;
  verserendeKlageEet?: 'Ja' | 'Nej' | undefined;
}>;

export type TafConstraintBounds = Readonly<{
  minStart?: ISODateString;
  maxEnd?: ISODateString;
}>;

const minDefined = (...values: Array<ISODateString | undefined>): ISODateString | undefined => {
  let current: ISODateString | undefined = undefined;
  for (const value of values) {
    if (!value) continue;
    if (!current || value < current) current = value;
  }
  return current;
};

const resolveEndeligEetDato = (values: TafConstraintSource): ISODateString | undefined => {
  if (values.endeligtEetAfgorelse !== 'Ja') return undefined;
  return values.endeligEETVirkningsdato ?? values.endeligEETAfgoerelseDato;
};

/**
 * Fejlgivende øvre grænse for TAF-perioder: strengeste af differencekravDato−1 og
 * EET-virkningsdato−1 (jf. eo-snapshot-contract.md §2.2).
 *
 * Korrekt adfærd: til-dato >= disse grænser er fejlgivende bounds — feltfejl (rød kant +
 * tooltip) vises i TAFPeriodeTable og fejlen gengives på EOBeregningTab, der blokerer download.
 * Engineen clamper stadig til den beregnede maxEnd for at producere korrekte resultater.
 */
export const resolveTafFejlgivendeBounds = (values: TafConstraintSource): TafConstraintBounds => {
  const differencekravMax = subtractOneDay(values.differencekravDato);

  const endeligEetDato = resolveEndeligEetDato(values);
  const endeligEetMax = values.verserendeKlageEet === 'Ja' ? undefined : subtractOneDay(endeligEetDato);

  const maxEnd = minDefined(differencekravMax, endeligEetMax);
  return { maxEnd };
};

/**
 * Stille clamping-grænser for TAF-perioder: kun EO-periodens grænser.
 *
 * Stille clamping (jf. eo-snapshot-contract.md §2.1): ingen fejlindikation.
 */
export const resolveTafEoPeriodeBounds = (values: TafConstraintSource): TafConstraintBounds => {
  return { minStart: values.vedroererPeriodeFra, maxEnd: values.vedroererPeriodeTil };
};

/**
 * Kombineret bounds-resolver der returnerer strengeste grænse fra alle kilder.
 * Bruges af debug-visninger og UI-komponenter der skal vise den endelige clampede dato.
 *
 * Til `buildTafRanges` bruges i stedet `resolveTafFejlgivendeBounds` + `resolveTafEoPeriodeBounds`
 * separat, da rækkefølgen af clampingen her er semantisk vigtig.
 */
export const resolveTafConstraintBounds = (values: TafConstraintSource): TafConstraintBounds => {
  const minStart = values.vedroererPeriodeFra;
  const erstatningsTil = values.vedroererPeriodeTil;

  const differencekravMax = subtractOneDay(values.differencekravDato);

  const endeligEetDato = resolveEndeligEetDato(values);
  const endeligEetMax = values.verserendeKlageEet === 'Ja' ? undefined : subtractOneDay(endeligEetDato);

  const maxEnd = minDefined(erstatningsTil, differencekravMax, endeligEetMax);
  return { minStart, maxEnd };
};

/**
 * Clamper en TAF-range til bounds. Returnerer null hvis perioden reduceres til ingenting.
 *
 * Denne funktion er bounds-agnostisk — den kender ikke forskel på stille og fejlgivende clamping.
 * Kalderen er ansvarlig for at anvende korrekte bounds i korrekt rækkefølge
 * (jf. eo-snapshot-contract.md §2.3 og buildTafRanges i indtaegtPerioder.ts).
 */
export const clampTafRange = (range: IsoRange, bounds: TafConstraintBounds): IsoRange | null => {
  let fra = range.fra;
  let til = range.til;

  if (bounds.minStart) {
    fra = maxISO(fra, bounds.minStart);
  }

  if (bounds.maxEnd) {
    til = minISO(til, bounds.maxEnd);
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
