import type { EetIssue } from './eetTypes';

/**
 * Beregningsdatoen indgår i flere EET-beregningsgrene. De skal altid beskrive den samme manglende værdi
 * ordret, så en sammenlagt projektion ikke får to synligt forskellige versioner af den samme fejl.
 */
export const MISSING_BEREGNINGSDATO_ISSUE: EetIssue = Object.freeze({
  id: 'beregningsdato-missing',
  severity: 'error',
  message: 'Beregningsdato er ikke udfyldt',
});

/**
 * Én advarsel for «en dato ligger efter beregningsdatoen», delt af løbende ydelser og differencekrav.
 *
 * Tidligere var det tre id'er – ét pr. datotype – som gav tre linjer i boksen om samme ene årsag
 * (BB-159). Id'et bor her og ikke i en af de to beregninger, så ingen af dem ejer den anden.
 */
export const EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID = 'warn-dato-after-beregningsdato';

/** Kap.dato-advarslerne (se `collectKapDatoWarnings` i `eetFieldWarnings`). */
export const KAP_DATO_EFTER_AFGOERELSESDATO_WARNING_ID = 'warn-kap-dato-efter-afgoerelsesdato';
export const KAP_DATO_INDEN_FOR_TO_AAR_WARNING_ID = 'warn-kap-dato-inden-for-to-aar-til-fp';

/** Én fejlidentitet kan komme fra flere EET-beregninger, men skal altid læses som ét manglende input. */
export const MISSING_KOEN_ISSUE: EetIssue = Object.freeze({
  id: 'missing-koen',
  severity: 'error',
  message: 'Køn skal angives, når kapitaliseringen sker før 1. marts 2015',
});
