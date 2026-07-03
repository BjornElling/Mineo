import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { getReguleringsDatoIntervalForOverenskomst } from '../../../data/overenskomstRates';
import { getReguleringsDatoIntervalForStatistikModel } from '../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, isKRLSatstabelId } from '../../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../../data/klLoenaftaler';
import { parseDanishToIso } from './eoSharedUtils';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Kildens reguleringsdato-interval i ISO. `fraIso` er kildens *reelle, tidligste* registrerede
 * satsdato — uafhængigt af TAF-perioden — og `tilIso` kildens seneste dækkede dato.
 */
export type KildeReguleringsInterval = Readonly<{
  fraIso?: ISODateString;
  tilIso?: ISODateString;
}>;

/**
 * Én autoritativ kilde til "hvor langt tilbage/frem har denne reguleringskilde data?".
 *
 * Slår kildens coverage-interval op for de fire interval-baserede lønudviklingsmodeller
 * (Overenskomst / Statistik / KRL-satstabel / KL-lønaftaler) via de samme
 * `getReguleringsDatoIntervalFor*`-funktioner, som validatoren og row-gaten allerede bruger, og
 * projicerer det til ISO.
 *
 * Bevidst afgrænsning: `fraIso` er kildens tidligste registrerede sats — den korrekte værdi til
 * "reguleringsgrundlaget indeholder ingen satser før X"-noten og til start/slut-dæknings-checket.
 * Brug ALDRIG en TAF-vindue-scopet delmængde (fx `relevantRealDates[0]` i reguleringsPresentation)
 * til dette; det var netop kilden til den falske note, hvor en satsændring mellem reguleringsdatoen
 * og TAF-periodens start fik noten til fejlagtigt at hævde manglende ældre satser.
 *
 * De manuelle modeller (`Manuelt angivet` / `Manuel procentsats`) har intet kilde-interval — deres
 * dækning afhænger af reguleringsdatoen og de indtastede rækker — og returnerer derfor `undefined`
 * (håndteres lokalt af kaldstederne).
 */
export const resolveKildeReguleringsIntervalIso = (
  af: Ansaettelsesforhold
): KildeReguleringsInterval | undefined => {
  const grundlag = af.loenudviklingBeregningsgrundlag;

  const toIso = (
    interval: Readonly<{ fraDato: string; tilDato: string }> | undefined
  ): KildeReguleringsInterval | undefined =>
    interval
      ? { fraIso: parseDanishToIso(interval.fraDato), tilIso: parseDanishToIso(interval.tilDato) }
      : undefined;

  if (grundlag === 'Overenskomst') {
    return toIso(getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? ''));
  }
  if (grundlag === 'Statistik') {
    return toIso(getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? ''));
  }
  if (grundlag === 'KRL satstabel') {
    const krlId = af.loenudviklingKRLSatstabel;
    if (!isKRLSatstabelId(krlId)) return undefined;
    return toIso(getReguleringsDatoIntervalForKRL(krlId));
  }
  if (grundlag === 'KL-lønaftaler') {
    return toIso(getReguleringsDatoIntervalForKlLoenaftaler());
  }

  return undefined;
};
