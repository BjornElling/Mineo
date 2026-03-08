import type { ISODateString } from '../../types/branded';
import { isISODateString, subtractOneDay } from '../../types/branded';
import type { IsoRange } from './tafPeriodConstraints';

export type SvieSmerteConstraintSource = Readonly<{
  vedroererPeriodeFra?: ISODateString | string | undefined;
  vedroererPeriodeTil?: ISODateString | string | undefined;
  varigeMenAfgorelse?: 'Ja' | 'Nej' | undefined;
  verserendeKlageMen?: 'Ja' | 'Nej' | undefined;
  menAfgoerelseDato?: ISODateString | string | undefined;
}>;

export type SvieSmerteConstraintBounds = Readonly<{
  minStart?: ISODateString;
  maxEnd?: ISODateString;
}>;

const minIso = (a: ISODateString, b: ISODateString): ISODateString => (a < b ? a : b);
const maxIso = (a: ISODateString, b: ISODateString): ISODateString => (a > b ? a : b);

const resolveIso = (value: unknown): ISODateString | undefined =>
  typeof value === 'string' && isISODateString(value) ? value : undefined;

/**
 * Fejlgivende øvre grænse for svie/smerte-perioder: menAfgoerelseDato − 1.
 * Returnerer undefined hvis ménafgørelse ikke er endelig (verserendeKlageMen = 'Ja' eller
 * varigeMenAfgorelse ≠ 'Ja').
 *
 * Korrekt adfærd (jf. eo-snapshot-contract.md §2.2): til-dato >= menAfgoerelseDato er en
 * fejlgivende bound — feltfejl (rød kant + tooltip) vises i SvieSmerteTable og fejlen
 * gengives på EOBeregningTab, der blokerer download.
 * Engineen clamper stadig til dayBeforeMen for at producere korrekte beregningsresultater.
 */
export const resolveSvieSmerteFejlgivendeBounds = (
  values: SvieSmerteConstraintSource,
): SvieSmerteConstraintBounds => {
  const shouldApplyMenCutoff =
    values.varigeMenAfgorelse === 'Ja' && values.verserendeKlageMen === 'Nej';
  const menAfgoerelseDato = shouldApplyMenCutoff
    ? resolveIso(values.menAfgoerelseDato)
    : undefined;
  const maxEnd = subtractOneDay(menAfgoerelseDato);
  return { maxEnd };
};

/**
 * Stille clamping-grænser for svie/smerte-perioder: kun EO-periodens grænser.
 *
 * Stille clamping (jf. eo-snapshot-contract.md §2.1): ingen fejlindikation.
 */
export const resolveSvieSmerteEoPeriodeBounds = (
  values: SvieSmerteConstraintSource,
): SvieSmerteConstraintBounds => {
  const minStart = resolveIso(values.vedroererPeriodeFra);
  const maxEnd = resolveIso(values.vedroererPeriodeTil);
  return { minStart, maxEnd };
};

/**
 * Clamper en svie/smerte-IsoRange til bounds.
 * Returnerer null hvis perioden reduceres til ingenting (fra > til) — dette er
 * normal og forventelig adfærd (jf. eo-snapshot-contract.md §2).
 */
export const clampSvieSmerteRange = (
  range: IsoRange,
  bounds: SvieSmerteConstraintBounds,
): IsoRange | null => {
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
