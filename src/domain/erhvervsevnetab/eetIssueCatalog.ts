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
