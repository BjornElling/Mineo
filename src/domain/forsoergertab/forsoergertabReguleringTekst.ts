// Den afsluttende sætning over det anvendte forsørgertab (BB-133).
//
// Sætningen var TODELT og kendte kun minimum: enten «… skal forhøjes til minimum, dvs. udgør» eller
// «… skal ikke forhøjes, dvs. udgør». Den anden gren stod derfor også over et beløb, der var sat NED til
// årets maksimum – og påstod, at der ikke var sket noget. Sætningen var dermed ikke bare upræcis, men
// usand i netop den situation, hvor loftet slog til: brugeren, der efterregnede, fandt 13.761.000 kr. og
// mødte 11.052.000 kr. under en linje, der sagde «skal ikke forhøjes».
//
// Programmet bar allerede svaret (`eetReduceretTilMaks`); det blev blot aldrig vist. Teksten er samlet her,
// fordi skærmen og dokumentet skal sige nøjagtig det samme – de to stod før som hver sin inline ternary.

export type ForsoergertabRegulering = Readonly<{
  /** Beregnet beløb lå under årets minimum og er hævet dertil. */
  forhoejetTilMin: boolean;
  /** Beregnet beløb lå over årets maksimum og er sat ned dertil. */
  nedsatTilMaks: boolean;
}>;

/**
 * Sætningen, der indleder linjen med det anvendte forsørgertab.
 *
 * De to grænser er gensidigt udelukkende – et beløb kan ikke både ligge under minimum og over maksimum –
 * men rækkefølgen er alligevel eksplicit, så en fremtidig datafejl giver en forudsigelig tekst frem for en
 * tilfældig.
 */
export const resolveForsoergertabReguleringTekst = (regulering: ForsoergertabRegulering): string => {
  if (regulering.forhoejetTilMin) return 'Det beregnede forsørgertab skal forhøjes til minimum, dvs. udgør';
  if (regulering.nedsatTilMaks) return 'Det beregnede forsørgertab skal nedsættes til maksimum, dvs. udgør';
  return 'Det beregnede forsørgertab skal ikke reguleres, dvs. udgør';
};
