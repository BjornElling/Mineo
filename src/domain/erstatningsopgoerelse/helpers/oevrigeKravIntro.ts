export const resolveOevrigeKravYdelsesforbeholdLinje = (
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

/**
 * Forbeholdslinjerne i opgørelsens afsnit «Øvrige krav».
 *
 * Forbeholdet om en verserende EET-klage stod før også her. Det er flyttet til TAF-afsnittets
 * EET-status (`buildTabtArbejdsfortjenesteModel`), hvor afgørelsen og «Afgørelsen er påklaget.»
 * står: klagen handler om EET, ikke om øvrige krav, og her forsvandt forbeholdet tavst, fordi en
 * ny sag starter med øvrige krav på «Skjul» (BB-233, udviklerafgørelse 2026-09-23).
 */
export const resolveOevrigeKravIntroLinjer = (params: Readonly<{
  ydelser: readonly string[];
}>): readonly string[] => {
  const ydelsesforbeholdLinje = resolveOevrigeKravYdelsesforbeholdLinje(params.ydelser);
  return ydelsesforbeholdLinje === null ? [] : [ydelsesforbeholdLinje];
};
