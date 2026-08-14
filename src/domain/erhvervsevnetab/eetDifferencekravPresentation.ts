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

/**
 * Hvorfor bilagsvalget "Mer-erstatning forhøjet folkepension" er inaktivt.
 *
 * Bilagsvalget skjules ikke, når der ikke er noget bilag at vælge (jf. `page-component-contract.md`
 * §"Bilagsvalg og andre betingede afkrydsningsfelter"): det vises inaktivt og umarkeret med årsagen i
 * tooltippet, så brugeren kan se, at valget findes, og hvorfor det ikke kan vælges lige nu.
 *
 * Rækkefølgen er bevidst: brugerens eget fravalg forklares FØR beregningsårsagen. Er togglen sat til
 * Nej, er mer-erstatningen slet ikke beregnet, og "Pensionsalderen er ikke forhøjet i perioden" ville da
 * være en påstand om et regnestykke, programmet ikke har udført — altså potentielt forkert.
 *
 * `null` betyder, at bilaget kan vælges (feltet er aktivt).
 */
export const resolveMerErstatningPensionsalderBilagDisabledReason = (
  indregnMerErstatning: boolean,
  harMerErstatning: boolean
): string | null => {
  if (!indregnMerErstatning) return 'Mer-erstatning er fravalgt nedenfor';
  if (!harMerErstatning) return 'Pensionsalderen er ikke forhøjet i perioden';
  return null;
};

/**
 * Hvorfor bilagsvalget "Proformakap. af rest-EET" er inaktivt.
 *
 * Fradraget for det resterende erhvervsevnetab opgøres på ÉN af to måder, aldrig begge: er der mere end
 * to år til folkepensionsalderen på beregningsdatoen, proformakapitaliseres resten; ellers opgøres den som
 * resterende løbende ydelser. Der er derfor to grunde til, at bilaget ikke kan vælges — ingen rest-EET at
 * opgøre, eller en rest der er opgjort som løbende ydelser og altså ikke har et proformabilag.
 *
 * `null` betyder, at bilaget kan vælges (feltet er aktivt).
 */
export const resolveProformaKapitaliseringBilagDisabledReason = (
  harProformaKapitalisering: boolean,
  harResterendeLoebendeYdelser: boolean
): string | null => {
  if (harProformaKapitalisering) return null;
  if (harResterendeLoebendeYdelser) return 'Resten er opgjort som løbende ydelser';
  return 'Der er intet rest-EET at proformakapitalisere';
};
