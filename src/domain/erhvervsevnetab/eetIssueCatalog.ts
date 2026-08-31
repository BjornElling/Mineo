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

/** Én fejlidentitet kan komme fra flere EET-beregninger, men skal altid læses som ét manglende input. */
export const MISSING_KOEN_ISSUE: EetIssue = Object.freeze({
  id: 'missing-koen',
  severity: 'error',
  message: 'Køn skal angives, når kapitaliseringen sker før 1. marts 2015',
});
