import { isoToDanish, type ISODateString } from '../../../types/branded';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';

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

/** Den aktive afgørelsesdato, som stopper svie/smerte-perioder. */
export const resolveSvieSmerteCutoffDate = (
  values: SvieSmerteConstraintSource,
): ISODateString | undefined => {
  if (values.varigeMenAfgorelse !== 'Ja' || values.verserendeKlageMen !== 'Nej') return undefined;
  return values.menAfgoerelseDato;
};

/**
 * Den fælles brugerbesked for svie/smerte efter ménafgørelsen.
 *
 * Den bruges både af række-evalueringen og den strukturelle feltissue-projektion. Hvis de to steder bygger
 * teksten hver for sig, får brugeren igen én besked ved feltet og en anden på Beregning-siden — netop den
 * drift som den konkrete fejl afslørede.
 */
export const buildSvieSmerteCutoffErrorMessage = (args: Readonly<{
  value: ISODateString | undefined;
  menAfgoerelseDato: ISODateString | undefined;
}>): string | undefined => {
  if (args.value === undefined || args.menAfgoerelseDato === undefined || args.value < args.menAfgoerelseDato) {
    return undefined;
  }
  const dateText = isoToDanish(args.menAfgoerelseDato) ?? args.menAfgoerelseDato;
  return `Der er angivet svie/smerte efter datoen for en ménafgørelse (${dateText})`;
};

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
  const menAfgoerelseDato = resolveSvieSmerteCutoffDate(values);
  const maxEnd = getDayBeforeIso(menAfgoerelseDato);
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
