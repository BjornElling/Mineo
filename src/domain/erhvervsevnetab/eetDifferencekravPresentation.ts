/**
 * Label til "Beregnet differencekrav"-rækken på differencekrav-fanen og i PDF'en.
 *
 * Når et gyldigt forlig om ansvarsgrad under 100 % er anvendt, vises forligs-label og det fulde
 * (ureducerede) krav i parentes, fx:
 *   "Beregnet differencekrav (2/3 af 1.095.121 kr.)"
 * Ved intet forlig (eller 100 %) vises blot "Beregnet differencekrav".
 *
 * `foerForligFormatted` skal være det allerede formaterede fulde krav (fx "1.095.121 kr.") — denne
 * funktion formaterer bevidst ikke selv beløb, så UI og PDF deler præcis samme tekst.
 */
export const buildBeregnetDifferencekravLabel = (
  forligLabel: string | null,
  foerForligFormatted: string
): string => {
  return forligLabel === null
    ? 'Beregnet differencekrav'
    : `Beregnet differencekrav (${forligLabel} af ${foerForligFormatted})`;
};
