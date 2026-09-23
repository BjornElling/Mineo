/**
 * Forbeholdene i opgørelsens afsnit «Tabt arbejdsfortjeneste».
 *
 * Begge stod tidligere under «Øvrige krav», hvor de forsvandt tavst, fordi en ny sag starter med øvrige krav
 * på «Skjul» – og hvor de heller ikke hørte hjemme: klagen handler om EET-afgørelsen, og ydelsesforbeholdet
 * om indtægterne i TAF-perioden (BB-233). Udviklerafgørelse 2026-09-23: de trykkes sidst i TAF-beregningen
 * under underoverskriften «Forbehold», hvert på sin egen linje.
 */

export const EET_KLAGE_FORBEHOLD_LINJE =
  'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.';

/** De ydelsestyper, der udløser ydelsesforbeholdet, når de indgår i indtægterne i TAF-perioden. */
export const TAF_FORBEHOLD_YDELSESTYPER: ReadonlySet<string> = new Set(['kontanthjaelp', 'ressourceforloebsydelse']);

export const resolveTafYdelsesforbeholdLinje = (
  ydelser: readonly string[]
): string | null => {
  const hasKontanthjaelp = ydelser.includes('kontanthjaelp');
  const hasRessourceforloebsydelse = ydelser.includes('ressourceforloebsydelse');

  if (!hasKontanthjaelp && !hasRessourceforloebsydelse) return null;

  const hasBeggeYdelser = hasKontanthjaelp && hasRessourceforloebsydelse;
  const ydelseTekst = hasBeggeYdelser
    ? 'kontanthjælp og ressourceforløbsydelse'
    : hasKontanthjaelp
      ? 'kontanthjælp'
      : 'ressourceforløbsydelse';
  const tilbagebetalingsSubjekt = hasBeggeYdelser ? 'ydelserne' : 'ydelsen';

  return `Skadelidte har modtaget ${ydelseTekst} i erstatningsperioden. Kræves ${tilbagebetalingsSubjekt} tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.`;
};
