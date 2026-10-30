import { erFeriePctPaakraevet, FERIE_PCT_MANGLER_BESKED } from '../../../domain/loen/feriePctKrav';
import {
  FERIE_PCT_MANGLER_BESKED as EO_FERIE_PCT_MANGLER_BESKED,
  isFeriePctPaakraevet,
} from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

// M-37 (udviklerafgørelse 2026-10-30): Årsløn og EO skal følges ad – ændres forudsætningen, ændres den begge steder.
// Testen låser, at EO's krav ER den fælles regel, og at de to flader skriver samme linje.

const raekkeMedLoen: StandardLoenTableRow = { id: 'r1', col0_maaned: '1', col1_maaned: '2025', col2: { kind: 'number', value: 30_000 } };

describe('erFeriePctPaakraevet – den fælles regel for begge lønflader', () => {
  it('kræver satsen, når satserne er i brug, der er løn, og satsen opgøres som feriegodtgørelse', () => {
    expect(erFeriePctPaakraevet({ satserErIBrug: true, loenraekker: [raekkeMedLoen], satsenOpgoeresSomFeriegodtgoerelse: true })).toBe(true);
  });

  it('kræver den ikke, når én af de tre forudsætninger mangler', () => {
    expect(erFeriePctPaakraevet({ satserErIBrug: false, loenraekker: [raekkeMedLoen], satsenOpgoeresSomFeriegodtgoerelse: true })).toBe(false);
    expect(erFeriePctPaakraevet({ satserErIBrug: true, loenraekker: [], satsenOpgoeresSomFeriegodtgoerelse: true })).toBe(false);
    expect(erFeriePctPaakraevet({ satserErIBrug: true, loenraekker: [raekkeMedLoen], satsenOpgoeresSomFeriegodtgoerelse: false })).toBe(false);
  });

  it('EO følger den fælles regel: altid opgjort som feriegodtgørelse, uanset løn under ferie', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
      indtaegtsoplysningerTableData: [raekkeMedLoen],
    };
    // EO's krav læser slet ikke «Fuld løn under ferie» (feltet er ikke en del af inputtypen), så svaret er det samme
    // for «Ja» og «Nej» – den fælles regels tredje led er altid sandt dér.
    for (const fuldLoenUnderFerie of ['Ja', 'Nej'] as const) {
      const medValg: Parameters<typeof isFeriePctPaakraevet>[0] = { ...af, fuldLoenUnderFerie } as typeof af;
      expect(isFeriePctPaakraevet(medValg)).toBe(
        erFeriePctPaakraevet({ satserErIBrug: true, loenraekker: [raekkeMedLoen], satsenOpgoeresSomFeriegodtgoerelse: true })
      );
    }
    expect(isFeriePctPaakraevet({ ...af, tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB })).toBe(false);
  });

  it('begge flader skriver samme linje i «Fejl og advarsler»', () => {
    expect(EO_FERIE_PCT_MANGLER_BESKED).toBe(FERIE_PCT_MANGLER_BESKED);
    expect(FERIE_PCT_MANGLER_BESKED).toBe('Feriegodtgørelse/-tillæg er ikke udfyldt');
  });
});
