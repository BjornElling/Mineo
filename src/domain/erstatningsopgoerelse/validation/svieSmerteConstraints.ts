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

/**
 * Sand, når ménafgørelsen stopper svie/smerte-perioderne – uanset om datoen er udfyldt. Afgørelsen er truffet,
 * og der er ingen verserende klage. Dækningsvurderingen spørger, om en afvist ménafgørelsesdato kunne have
 * flyttet kravets slutning, og skal derfor kende betingelsen uden datoen.
 */
export const erSvieSmerteMenAfskaeringAktiv = (values: SvieSmerteConstraintSource): boolean =>
  values.varigeMenAfgorelse === 'Ja' && values.verserendeKlageMen === 'Nej';

/** Den aktive afgørelsesdato, som stopper svie/smerte-perioder. */
export const resolveSvieSmerteCutoffDate = (
  values: SvieSmerteConstraintSource,
): ISODateString | undefined => {
  if (!erSvieSmerteMenAfskaeringAktiv(values)) return undefined;
  return values.menAfgoerelseDato;
};

/**
 * Den fælles brugerbesked for svie/smerte efter ménafgørelsen.
 *
 * Den bruges både af række-evalueringen og den strukturelle feltissue-projektion. Hvis de to steder bygger
 * teksten hver for sig, får brugeren igen én besked ved feltet og en anden på Beregning-siden – netop den
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
  return `Der er angivet svie/smerte på eller efter datoen for en ménafgørelse (${dateText})`;
};

/**
 * Periodens linje i «Fejl og advarsler». Ligger allerede fra-datoen på eller efter ménafgørelsen, ligger hele
 * perioden der, og linjen siger det – samme form som TAF-periodernes (BB-244). Ellers er det til-cellens
 * besked. Cellerne beholder hver sin besked fra `buildSvieSmerteCutoffErrorMessage`.
 */
export const buildSvieSmertePeriodeCutoffErrorMessage = (args: Readonly<{
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  menAfgoerelseDato: ISODateString | undefined;
}>): string | undefined => {
  const { fra, til, menAfgoerelseDato } = args;
  if (menAfgoerelseDato === undefined) return undefined;
  if (fra !== undefined && fra >= menAfgoerelseDato) {
    return `Hele perioden ligger på eller efter datoen for ménafgørelsen (${isoToDanish(menAfgoerelseDato) ?? menAfgoerelseDato})`;
  }
  return buildSvieSmerteCutoffErrorMessage({ value: til, menAfgoerelseDato });
};

/**
 * Fejlgivende øvre grænse for svie/smerte-perioder: menAfgoerelseDato − 1.
 * Returnerer undefined hvis ménafgørelse ikke er endelig (verserendeKlageMen = 'Ja' eller
 * varigeMenAfgorelse ≠ 'Ja').
 *
 * Korrekt adfærd (jf. eo-snapshot-contract.md §2.2): til-dato >= menAfgoerelseDato er en
 * fejlgivende bound – feltfejl (rød kant + tooltip) vises i SvieSmerteTable og fejlen
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
 * Returnerer null hvis perioden reduceres til ingenting (fra > til) – dette er
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

/**
 * Den seneste svie/smerte-dag, der faktisk indgår: hver udfyldt periode afklippet som i motoren – først
 * mod ménafgørelsen (dagen før), dernæst mod EO-perioden. `undefined`, når ingen dag indgår.
 *
 * Den rå til-dato må ikke bruges til ophørsgrunden: en periode, der løber ud over ménafgørelsen eller
 * EO-perioden, ville ellers pege på et ophør, dokumentet ikke nævner.
 */
export const resolveSvieSmerteSenesteKravDato = (
  values: SvieSmerteConstraintSource & Readonly<{
    svieSmertePerioder?: ReadonlyArray<Readonly<{ fra?: ISODateString | undefined; til?: ISODateString | undefined; tilstand?: string | undefined }>> | undefined;
  }>,
): ISODateString | undefined => {
  const fejlgivende = resolveSvieSmerteFejlgivendeBounds(values);
  const eoPeriode = resolveSvieSmerteEoPeriodeBounds(values);
  let seneste: ISODateString | undefined = undefined;
  for (const periode of values.svieSmertePerioder ?? []) {
    if (!periode.fra || !periode.til || !periode.tilstand || periode.fra > periode.til) continue;
    const efterMen = clampSvieSmerteRange({ fra: periode.fra, til: periode.til }, fejlgivende);
    const clamped = efterMen ? clampSvieSmerteRange(efterMen, eoPeriode) : null;
    if (clamped && (!seneste || clamped.til > seneste)) seneste = clamped.til;
  }
  return seneste;
};

/**
 * Hvilke afgrænsninger den seneste indgående svie/smerte-dag rammer. Ét udsagn, som både dokumentets
 * ménlinje («Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.») og EO-kontrollens
 * «Svie/smerte-ophør skyldes» læser, så de ikke kan nævne hver sin grund.
 *
 * `senesteKravDato` SKAL være afklippet (`resolveSvieSmerteSenesteKravDato` eller motorens
 * `constrainedPeriods`). Da intet ligger efter afklipningen, er «perioderne dækker dagen før ménafgørelsen»
 * og «den seneste dag ER dagen før» samme udsagn.
 */
export const resolveSvieSmerteOphoer = (
  values: SvieSmerteConstraintSource,
  senesteKravDato: ISODateString | undefined,
): Readonly<{ erstatningsperiodensOphoer: boolean; menafgoerelse: boolean }> => {
  if (!senesteKravDato) return { erstatningsperiodensOphoer: false, menafgoerelse: false };
  const menDagenFoer = getDayBeforeIso(resolveSvieSmerteCutoffDate(values));
  return {
    erstatningsperiodensOphoer: values.vedroererPeriodeTil !== undefined && senesteKravDato === values.vedroererPeriodeTil,
    menafgoerelse: menDagenFoer !== undefined && senesteKravDato === menDagenFoer,
  };
};
