import { formatAsAmount, formatKr } from './formatUtils';

// Fradragslinjens fortegn – samme regel på alle flader, også Varige mén.
//
// **Reglen:** et fortegn påstår en RETNING. Et nul har ingen, så «- 0 kr.» er forkert – det skal være
// «0 kr.». Minusset er en egenskab ved TALLET, ikke en fast del af skabelonen.
//
// Fradragslinjerne på Forsørgertab, Erhvervsevnetab efter EAL, Differencekrav og deres dokumentgeneratorer
// bruger alle denne helper frem for `` `- ${formatKr(x)}` `` eller en inline ternary, så reglen ikke kan
// glemmes ét sted. Ellers kan samme tal stå som «Kapitalbeløb (efter ASL) - 0 kr.» i resultatsektionen og
// «Kapitalbeløb 0 kr.» i ASL-panelet – to visninger på samme skærm, uenige om formen.
//
// **Vagten tester den AFRUNDEDE værdi, ikke råværdien.** `formatKr` afrunder, så `0,004` ville formatere
// til «0» men slippe forbi en `=== 0`-test på råværdien og få et minus foran et synligt nul. Det er præcis
// den fejl, reglen skal forhindre, så vagten spørger om det, brugeren FÅR AT SE.

/** Er beløbet nul, EFTER den afrunding visningen bruger? Ét sted, så vagten ikke kan sættes på råværdien. */
const roundsToZero = (value: number, precision: 0 | 2): boolean =>
  formatAsAmount(Math.abs(value), precision) === formatAsAmount(0, precision);

/**
 * Et fradragsbeløb med minus foran – men kun når der faktisk trækkes noget fra.
 *
 * Brug denne i ENHVER sammentællingslinje, hvor minusset hører til fradraget frem for til tallet:
 * `formatDeductionKr(x)` i stedet for `` `- ${formatKr(x)}` ``.
 */
export const formatDeductionKr = (value: number, precision: 0 | 2 = 0): string =>
  formatDeduction(value, formatKr(value, precision), precision);

/**
 * Fortegnsreglen for en linje, der formaterer sit beløb SELV – fx `formatCurrencyFromOreTrimmed`, som
 * trimmer «,00» og sætter et hårdt mellemrum efter minus.
 *
 * Vagten skal måle mod det, kalderen faktisk viser. Målte den altid mod `formatAsAmount`, ville en anden
 * formatters afrunding kunne vise et nul, som vagten ikke genkendte – og så ville dokumentet skrive
 * «- 0 kr.», hvor skærmen skriver «0 kr.» – en selvmodsigelse mellem to kanaler.
 *
 * `precision` er den, kalderens egen formatter bruger, så vagten og visningen afrunder ens.
 */
export const formatDeduction = (value: number, formatted: string, precision: 0 | 2 = 0): string =>
  roundsToZero(value, precision) ? formatted : `- ${formatted}`;

/**
 * Samme regel for en procentsats, der vises som et fradrag – fx aldersreduktionens «(- 16 %)», som ved en
 * reduktion på nul skal stå som «(0 %)».
 *
 * Procenten formateres af kalderen, fordi de fire kaldssteder bruger hver sin formatering
 * (`formatPct`, `formatPercent` og en rå `${pct} %`); helperen bestemmer kun FORTEGNET.
 */
export const formatDeductionPercent = (value: number, formatted: string): string =>
  value === 0 ? formatted : `- ${formatted}`;
