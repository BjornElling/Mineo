import { formatAsAmount, formatKr } from './formatUtils';

// Fradragslinjens fortegn (BB-129/BB-130, videreførelse af BB-073's afgørelse på Varige mén).
//
// **Reglen:** et fortegn påstår en RETNING. Et nul har ingen, så «- 0 kr.» er forkert – det skal være
// «0 kr.». Minusset er en egenskab ved TALLET, ikke en fast del af skabelonen.
//
// Fejlen fandtes i 19 fradragslinjer på tværs af Forsørgertab, Erhvervsevnetab efter EAL, Differencekrav
// og deres fire dokumentgeneratorer, hver skrevet som `` `- ${formatKr(x)}` `` uden nogen vagt. Det gav
// samtidig BB-130's synlige selvmodsigelse: «Kapitalbeløb (efter ASL) - 0 kr.» i resultatsektionen og
// «Kapitalbeløb 0 kr.» i ASL-panelet – to visninger af samme tal på samme skærm, uenige om formen.
//
// BB-073 løste det med en inline ternary, gentaget to steder. Med 19 flere kaldssteder er en helper det
// rigtige: reglen kan ikke længere glemmes på det tyvende.
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
 * «- 0 kr.», hvor skærmen skriver «0 kr.». Det er nøjagtig den selvmodsigelse mellem to kanaler, BB-130
 * handlede om, blot flyttet ét lag ned.
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
