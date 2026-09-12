import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildEoOffentligeYdelserRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('CALC-006 – uafhængigt facit for midlertidig EET-konsistens', () => {
  it('viser advarsel når TAF-perioden fortsætter efter midlertidig EET-virkning uden ydelser', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2010-01-10'),
      // Ved aktiv klage ophæves EET-clampingen, så TAF-perioden reelt kan fortsætte efter virkningsdatoen.
      verserendeKlageEet: 'Ja',
      tafPerioder: [
        {
          id: 'taf-after-midlertidig-eet',
          fra: iso('2010-01-01'),
          til: iso('2010-01-31'),
          loseFeriedage: undefined,
        },
      ],
      offentligeYdelserRows: [],
    };

    const rows = buildEoOffentligeYdelserRows(values, iso('2010-01-01'));

    // Factoryen leverer kun typed baggrundsværdier. Facit er den statiske række nedenfor.
    expect(rows).toEqual([
      {
        id: 'midlertidigtEetKonsistens.afgorelseUdenYdelser',
        label: 'Advarsel',
        displayValue: 'Advarsel (Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
      },
    ]);
  });
});
