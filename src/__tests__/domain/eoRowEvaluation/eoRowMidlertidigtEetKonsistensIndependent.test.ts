import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { buildEoOffentligeYdelserRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

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

  it('viser advarsel når midlertidige EET-ydelser er indtastet uden afgørelse', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEETAfgorelse: 'Nej',
      offentligeYdelserRows: [{
        id: 'eet-ydelse-uden-afgoerelse',
        fraDato: iso('2024-07-06'),
        tilDato: iso('2024-07-07'),
        ydelsestype: 'midlertidigt_eet',
        ydelse: amount(800),
        tillaeg: amount(200),
      }],
    };

    const rows = buildEoOffentligeYdelserRows(values);

    // 800 kr. + 200 kr. = 1.000 kr. i midlertidig EET-ydelse, men afgørelsen er ikke angivet.
    expect(rows).toEqual([
      {
        id: 'offentligeYdelser.ydelsestype-midlertidigt_eet',
        label: 'Midlertidigt EET',
        displayValue: 'ok',
        status: 'ok',
        summaryDisplay: 'default',
      },
      {
        id: 'midlertidigtEetKonsistens.ydelerUdenAfgorelse',
        label: 'Advarsel',
        displayValue: 'Advarsel (Der er indtastet midlertidige EET-ydelser, men ikke angivet en afgørelse)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
      },
    ]);
  });
});
