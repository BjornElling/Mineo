import type { ISODateString } from '../../../types/branded';
import { subtractOneDay } from '../../../types/branded';
import { minISO, maxISO } from '../../../utils/isoDateHelpers';
import type { IsoRange } from './tafPeriodConstraints';

export type SvieSmerteConstraintSource = Readonly<{
  vedroererPeriodeFra?: ISODateString | undefined;
  vedroererPeriodeTil?: ISODateString | undefined;
  varigeMenAfgorelse?: 'Ja' | 'Nej' | undefined;
  verserendeKlageMen?: 'Ja' | 'Nej' | undefined;
  menAfgoerelseDato?: ISODateString | undefined;
}>;

export type SvieSmerteConstraintBounds = Readonly<{
  minStart?: ISODateString;
  maxEnd?: ISODateString;
}>;

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
  const menAfgoerelseDato = shouldApplyMenCutoff ? values.menAfgoerelseDato : undefined;
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
  return { minStart: values.vedroererPeriodeFra, maxEnd: values.vedroererPeriodeTil };
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
    fra = maxISO(fra, bounds.minStart);
  }
  if (bounds.maxEnd) {
    til = minISO(til, bounds.maxEnd);
  }
  if (fra > til) return null;
  return { fra, til };
};
