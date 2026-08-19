import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { FORM_REGISTRY } from '../engines/regulering/reguleringFormRegistry';
import type { KildeReguleringsInterval } from '../engines/regulering/reguleringForm';

export type { KildeReguleringsInterval };

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Én autoritativ kilde til "hvor langt tilbage/frem har denne reguleringskilde data?".
 *
 * Dispatcher til reguleringsformens `coverageInterval` (FORM_REGISTRY), så validator, row-gate
 * og note-lag deler præcis samme per-form dæknings-opslag (jf. R1/R4). De fire interval-baserede
 * modeller (Overenskomst / Statistik / KRL-satstabel / KL-lønaftaler) returnerer deres kilde-
 * interval; de manuelle modeller (`Manuelt angivet` / `Manuel procentsats`) og `Ingen` har intet
 * kilde-interval og returnerer `undefined` (håndteres lokalt af kaldstederne).
 *
 * Bevidst afgrænsning: `fraIso` er kildens *tidligste registrerede sats* – den korrekte værdi til
 * "reguleringsgrundlaget indeholder ingen satser før X"-noten og til start/slut-dæknings-checket.
 * Brug ALDRIG en TAF-vindue-scopet delmængde (fx `relevantRealDates[0]` i reguleringsPresentation)
 * til dette; det var netop kilden til den falske note, hvor en satsændring mellem reguleringsdatoen
 * og TAF-periodens start fik noten til fejlagtigt at hævde manglende ældre satser.
 */
export const resolveKildeReguleringsIntervalIso = (
  af: Ansaettelsesforhold
): KildeReguleringsInterval | undefined => {
  const grundlag = af.loenudviklingBeregningsgrundlag;
  if (!grundlag) return undefined;
  return FORM_REGISTRY[grundlag].coverageInterval(af);
};
