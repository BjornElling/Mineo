/**
 * EAL-kravets brugervendte tekster. De ligger her, fordi skærmen og dokumentet skal sige nøjagtig
 * det samme – de to stod før som hver sin inline-litteral.
 */

/**
 * Kravets grundprincip, sat før mellemregningen. Linjen er rent pædagogisk: den fortæller, hvad de
 * to trin nedenfor tilsammen gør, så en læser ikke skal slutte det af tallene.
 */
export const FORSOERGERTAB_EAL_GRUNDPRINCIP =
  'Forsørgertabserstatning beregnes som 30 % af skadelidtes fulde erhvervsevnetab (jf. EAL § 13)';

/**
 * Sætningen, der indleder linjen med det anvendte forsørgertab.
 *
 * Begge grene skal sige sandt om, hvad der faktisk skete: står formen «skal ikke forhøjes» over et
 * beløb, der ER hævet til årets mindstebeløb, kan en modpart ikke efterregne linjen.
 */
export const resolveForsoergertabMinimumTekst = (forhoejetTilMin: boolean): string =>
  forhoejetTilMin
    ? 'Det beregnede forsørgertab skal forhøjes til minimum, dvs. udgør'
    : 'Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør';
