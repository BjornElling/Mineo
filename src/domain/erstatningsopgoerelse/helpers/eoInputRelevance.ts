import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { isFerieRowEmpty, isOevrigeKravRowEmpty, isSvieSmerteRowEmpty, isTafRowEmpty } from './rowEmpty';

/**
 * Relevans-/neutraliseringslag for erstatningsopgørelse-input.
 *
 * BAGGRUND: Synligheden af felter og rækker i EO-UI'en styres af betingelser
 * (sektions-toggles, "tidligere beregnet S/S til max", første-opgørelse osv.).
 * Beregningsmotorerne læste tidligere nogle af disse felter ubetinget — fx blev
 * `svieSmerteTidligereTotal` trukket fra svie/smerte-loftet selv ved FØRSTE opgørelse,
 * hvor feltet er skjult i UI'en. Dermed kunne en skjult (irrelevant) indtastning sænke
 * det beregnede krav. Synlighed var i praksis defineret to gange — i UI'en og spejlet i
 * hånden inde i hver motor — og de to definitioner kunne divergere.
 *
 * Dette modul er den ENESTE autoritative kilde til "hvilke input er relevante givet de
 * aktuelle valg". `neutralizeIrrelevantEoInputs` blanker irrelevante input, FØR motorerne
 * kører, så ingen motor (nuværende eller fremtidig) kan se en forældet skjult værdi.
 * Fail-closed: glemmer en motor at spejle en synligheds-betingelse, er værdien allerede
 * neutraliseret her. Predikaterne deles med UI'en, så "skjult i UI" og "ignoreret i
 * beregning" ikke kan divergere.
 *
 * BEVIDST UNDTAGELSE — komprimering ved EO 2+: Når
 * `komprimerBeregningEfterFoersteOpgoerelse === 'Ja'` fra og med 2. opgørelse, skjules
 * løn-/beregningsgrundlags-felterne (`beregnesUdFra`, beregningsperiode, fravær, angivet
 * løn, lønindkomst, lønudvikling, anciennitet) i UI'en, MEN de forbliver aktive input:
 * tabt arbejdsfortjeneste genberegnes fra dem, og PDF'en viser resuméet "Månedsløn er i
 * tidligere erstatningsopgørelse beregnet til X". Disse felter neutraliseres derfor IKKE
 * her. Mode-gating af beregningsgrundlaget (hvilket løn-felt der er aktivt afhængigt af
 * `beregnesUdFra`) ejes fortsat af indkomst-motoren, fordi den aktive mode altid er et
 * relevant input — også når UI'en er komprimeret.
 */

/** Svie/smerte-sektionen er aktiv (krav medregnes). */
export const erSvieSmerteSektionAktiv = (values: ErstatningsopgoerelseValues): boolean =>
  values.kravPaaSvieSmerteGodtgoerelse === 'Ja';

/**
 * Svie/smerte-periodeinput (perioder, sats-år, "allerede modtaget") er relevant.
 * Skjules når sektionen er fra, eller når "tidligere beregnet S/S til max" er slået til.
 */
export const erSvieSmertePeriodeInputRelevant = (values: ErstatningsopgoerelseValues): boolean =>
  erSvieSmerteSektionAktiv(values) && values.tidligereSsMax !== 'Ja';

/**
 * "Svie/smerte-krav i tidligere erstatningsopgørelser" er relevant.
 * Ud over periode-relevansen kræver det, at dette IKKE er første opgørelse — der findes
 * ingen tidligere opgørelse at fradrage ved første opgørelse. Dette er kernen i fejlen:
 * UI'en skjuler feltet ved første opgørelse, men motoren fradrog det alligevel.
 */
export const erSvieSmerteTidligereTotalRelevant = (values: ErstatningsopgoerelseValues): boolean =>
  erSvieSmertePeriodeInputRelevant(values) && !erDetteFoersteErstatningsopgoerelse(values.eoNummer);

/** Tabt arbejdsfortjeneste-sektionen er aktiv (krav medregnes). */
export const erTabtArbejdsfortjenesteSektionAktiv = (values: ErstatningsopgoerelseValues): boolean =>
  values.kravPaaTabtArbejdsfortjeneste === 'Ja';

/** Øvrige erstatningskrav-sektionen er aktiv (krav medregnes). */
export const erOevrigeKravSektionAktiv = (values: ErstatningsopgoerelseValues): boolean =>
  values.kravPaaOevrigeErstatningskrav === 'Ja';

/**
 * Returnerer en kopi af EO-værdierne, hvor alle input i skjulte/irrelevante felter og
 * rækker er neutraliseret til deres tomme værdi (undefined / []). Committed brugerinput
 * mutateres ikke — kun den effektive beregningskopi.
 *
 * Bruges af `computeEoSnapshot` til at danne `effectiveEoValues`, som alle motorer,
 * præsentation og debug læser fra. Se moduldokumentationen for den bevidste
 * komprimerings-undtagelse, der bevidst IKKE neutraliseres her.
 */
export const neutralizeIrrelevantEoInputs = (
  values: ErstatningsopgoerelseValues,
): ErstatningsopgoerelseValues => {
  const patch: Partial<ErstatningsopgoerelseValues> = {};

  // Array-felter blankes kun, når de faktisk indeholder ikke-tomt indhold. Tomme
  // placeholder-rækker (fra ensure*Rows) påvirker ikke beregning, og at fjerne dem ville
  // blot give unødig afvigelse i debug/præsentation.
  const harIndhold = <T>(rows: readonly T[], isEmpty: (row: T) => boolean): boolean =>
    rows.some((row) => !isEmpty(row));

  // Svie/smerte: periodeinput
  if (!erSvieSmertePeriodeInputRelevant(values)) {
    if (harIndhold(values.svieSmertePerioder, isSvieSmerteRowEmpty)) patch.svieSmertePerioder = [];
    if (values.svieSmerteSatserAar !== undefined) patch.svieSmerteSatserAar = undefined;
    if (values.svieSmerteAktuelPeriode !== undefined) patch.svieSmerteAktuelPeriode = undefined;
  }

  // Svie/smerte: "tidligere erstatningsopgørelser" (den oprindelige fejl)
  if (!erSvieSmerteTidligereTotalRelevant(values) && values.svieSmerteTidligereTotal !== undefined) {
    patch.svieSmerteTidligereTotal = undefined;
  }

  // Tabt arbejdsfortjeneste: perioder og ferieperioder (kun sektions-niveau —
  // beregningsgrundlaget undtages bevidst, jf. komprimerings-undtagelsen ovenfor)
  if (!erTabtArbejdsfortjenesteSektionAktiv(values)) {
    if (harIndhold(values.tafPerioder, isTafRowEmpty)) patch.tafPerioder = [];
    if (harIndhold(values.ferieperioder, isFerieRowEmpty)) patch.ferieperioder = [];
  }

  // Øvrige erstatningskrav
  if (!erOevrigeKravSektionAktiv(values) && harIndhold(values.oevrigeKravPerioder, isOevrigeKravRowEmpty)) {
    patch.oevrigeKravPerioder = [];
  }

  if (Object.keys(patch).length === 0) return values;
  return { ...values, ...patch };
};
