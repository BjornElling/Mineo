import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';

// Forhøjelser af folkepensionsalderen, der udløser mer-erstatning i differencekrav.
//
// Når et erhvervsevnetab tidligere er kapitaliseret, og folkepensionsalderen senere forhøjes,
// er kapitalbeløbet beregnet til en for lav pensionsalder. Differencekravet fradrager derfor
// forskellen mellem kapitalværdien til den nye (højere) og den gamle folkepensionsalder.
//
// Hver forhøjelse afspejles i kapitaliseringstabellerne ved, at en ny bekendtgørelse/vejledning
// flytter fødselsårgangene til tabeller med højere folkepensionsalder. Mer-erstatningen beregnes
// ved at køre den almindelige kapitaliseringsberegning to gange — én gang under bekendtgørelsen
// før forhøjelsen og én gang under bekendtgørelsen fra forhøjelsen — og tage differencen.
//
// Struktur:
//   - forhoejelsesdato: forhøjelsens ikrafttrædelsesdato. Alt beregnes på denne dato (alder, sats).
//     (Bevidst ikke "virkningsdato": det ord er reserveret til erhvervsevnetabsafgørelsernes
//     virkningsdato andetsteds i differencekravet, og sammenfaldet skabte forvirring.)
//   - opslagsdatoGammel / opslagsdatoNy: datoer der via resolveKapitaliseringsbekendtgoerelseId
//     slår henholdsvis den gamle og den nye bekendtgørelse op. De er adskilt fra forhøjelsesdatoen,
//     fordi bekendtgørelsesoversigten ikke altid har en post præcis på forhøjelsesdatoen
//     (se 69→70 nedenfor).
//   - gammelAlderLabel / nyAlderLabel: visningslabels til specifikation og PDF.
//
// 65→67-indfasningen (L 485/2009, virkning 1. juli 2009) er bevidst udeladt: de dagældende
// kapitaliseringstabeller afspejlede ikke en forhøjet folkepensionsalder, og forhøjelsen
// udløser derfor ikke mer-erstatning efter denne model.
//
// Sådan tilføjes en ny forhøjelse:
//   1. Tilføj en post nederst med forhøjelsesdato og de to opslagsdatoer.
//   2. Bekræft at resolveKapitaliseringsbekendtgoerelseId giver forskellige bekendtgørelser
//      for opslagsdatoGammel og opslagsdatoNy (ellers giver forhøjelsen 0 kr.).

export interface ForhoejetPensionsalderEvent {
  forhoejelsesdato: ISODateString
  opslagsdatoGammel: ISODateString
  opslagsdatoNy: ISODateString
  gammelAlderLabel: string
  nyAlderLabel: string
}

type RawForhoejetPensionsalderEvent = Readonly<{
  forhoejelsesdato: string;
  opslagsdatoGammel: string;
  opslagsdatoNy: string;
  gammelAlderLabel: string;
  nyAlderLabel: string;
}>;

const RAW_FORHOEJET_PENSIONSALDER_EVENTS: readonly RawForhoejetPensionsalderEvent[] = [
  // 67 → 68. L 395/2015 (Lov nr. 1810 af 23-12-2015), i kraft dagen efter offentliggørelse = 29-12-2015.
  // Bkg. 198/2015 (til 67 år) → Bkg. 1700/2015 (til 68 år).
  {
    forhoejelsesdato: '2015-12-29',
    opslagsdatoGammel: '2015-12-28',
    opslagsdatoNy: '2015-12-29',
    gammelAlderLabel: '67 år',
    nyAlderLabel: '68 år',
  },

  // 68 → 69. L 105/2020 (vedtaget 21-12-2020), i kraft 31-12-2020 for årgange fra 1967.
  {
    forhoejelsesdato: '2020-12-31',
    opslagsdatoGammel: '2020-12-30',
    opslagsdatoNy: '2020-12-31',
    gammelAlderLabel: '68 år',
    nyAlderLabel: '69 år',
  },

  // 69 → 70. L 710/2020 (forhøjelse vedtaget 22-05-2025), i kraft 31-12-2025 for årgange fra 1971.
  // Vejl. 10183/2025 (gælder specifikt for kapitalisering den 31-12-2025) indeholder tabeller til
  // det 70. år. Opslagsdatoerne parres derfor på selve forhøjelsesdatoen: gammel = 30-12-2025
  // (Vejl. 10029/2024, kun til 69 år), ny = 31-12-2025 (Vejl. 10183/2025, til 70 år). Selve
  // beregningen sker på forhøjelsesdatoen 31-12-2025 (satsår = 1 måned efter = 31-01-2026 → 2026).
  {
    forhoejelsesdato: '2025-12-31',
    opslagsdatoGammel: '2025-12-30',
    opslagsdatoNy: '2025-12-31',
    gammelAlderLabel: '69 år',
    nyAlderLabel: '70 år',
  },
];

export const forhoejetPensionsalderEvents: readonly ForhoejetPensionsalderEvent[] =
  RAW_FORHOEJET_PENSIONSALDER_EVENTS.map((event) => ({
    forhoejelsesdato: toISODateString(event.forhoejelsesdato),
    opslagsdatoGammel: toISODateString(event.opslagsdatoGammel),
    opslagsdatoNy: toISODateString(event.opslagsdatoNy),
    gammelAlderLabel: event.gammelAlderLabel,
    nyAlderLabel: event.nyAlderLabel,
  }));

export const assertForhoejetPensionsalderEventsIntegritet = (
  events: readonly ForhoejetPensionsalderEvent[],
): void => {
  if (events.length === 0) {
    throw new Error('Forhøjet pensionsalder: eventlisten er tom');
  }

  let previousDate: ISODateString | null = null;
  for (const event of events) {
    if (previousDate !== null && event.forhoejelsesdato <= previousDate) {
      throw new Error('Forhøjet pensionsalder: events skal være unikke og sorteret stigende');
    }
    if (event.opslagsdatoGammel >= event.opslagsdatoNy) {
      throw new Error(`Forhøjet pensionsalder ${event.forhoejelsesdato}: gammel opslagsdato skal ligge før ny`);
    }
    if (event.gammelAlderLabel.trim() === '' || event.nyAlderLabel.trim() === '') {
      throw new Error(`Forhøjet pensionsalder ${event.forhoejelsesdato}: alderslabels må ikke være tomme`);
    }
    previousDate = event.forhoejelsesdato;
  }
};

assertForhoejetPensionsalderEventsIntegritet(forhoejetPensionsalderEvents);
