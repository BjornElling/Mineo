import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

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

export const resolveOevrigeKravEetKlageReguleringsLinje = (
  eoValues: ErstatningsopgoerelseValues
): string | null => {
  if (eoValues.verserendeKlageEet !== 'Ja') return null;

  const harMidlertidigEetOplysning =
    eoValues.midlertidigtEETAfgorelse === 'Ja' &&
    (eoValues.midlertidigEETVirkningsdato !== undefined || eoValues.midlertidigEETAfgoerelseDato !== undefined);
  const harEndeligEetOplysning =
    eoValues.endeligtEETAfgorelse === 'Ja' &&
    (eoValues.endeligEETVirkningsdato !== undefined || eoValues.endeligEETAfgoerelseDato !== undefined);

  if (!harMidlertidigEetOplysning && !harEndeligEetOplysning) return null;

  return 'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.';
};

export const resolveOevrigeKravIntroLinjer = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  ydelser: readonly string[];
}>): readonly string[] => {
  const ydelsesforbeholdLinje = resolveOevrigeKravYdelsesforbeholdLinje(params.ydelser);
  const eetKlageReguleringsLinje = resolveOevrigeKravEetKlageReguleringsLinje(params.eoValues);

  return [ydelsesforbeholdLinje, eetKlageReguleringsLinje].filter((line): line is string => line !== null);
};
