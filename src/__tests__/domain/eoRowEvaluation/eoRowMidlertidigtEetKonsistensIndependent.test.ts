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

  // BB-240: efter 16. juni 2011 løber TAF videre efter en midlertidig afgørelse, og ydelsen skal
  // fradrages. Advarslen læser afgørelsens dato som oplysning – ikke gennem afskæringsprædikatet, der
  // svarer «ingen dato» for alle skader fra 2011.
  const efter2011 = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
    ...createErstatningsopgoerelseInitialValues(),
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    midlertidigtEETAfgorelse: 'Ja',
    midlertidigEETAfgoerelseDato: iso('2023-03-01'),
    tafPerioder: [{ id: 'taf-2024', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
    offentligeYdelserRows: [],
    ...overrides,
  });
  const SKADEDATO_EFTER_2011 = iso('2018-06-01');
  const advarselIds = (values: ErstatningsopgoerelseValues) =>
    buildEoOffentligeYdelserRows(values, SKADEDATO_EFTER_2011)
      .filter((row) => row.id.startsWith('midlertidigtEetKonsistens.'))
      .map((row) => `${row.id}:${row.status}`);

  it('advarer for en skade efter 2011, når TAF løber efter afgørelsen uden midlertidigt EET-ydelser', () => {
    expect(advarselIds(efter2011({}))).toEqual(['midlertidigtEetKonsistens.afgorelseUdenYdelser:warning']);
  });

  it('er tavs, når TAF slutter før afgørelsens dato', () => {
    expect(advarselIds(efter2011({ midlertidigEETAfgoerelseDato: iso('2025-01-01') }))).toEqual([]);
  });

  it('regner midlertidigt EET indsat fra Erhvervsevnetab-siden som angivet', () => {
    expect(advarselIds(efter2011({ midlertidigtEetFraEetSiden: 'Ja' }))).toEqual([]);
  });

  it('genkender en manuel række, hvis ydelsestype er gemt som den viste label', () => {
    expect(advarselIds(efter2011({
      offentligeYdelserRows: [{
        id: 'label-gemt',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-12-31'),
        ydelsestype: 'Midlertidigt EET',
        ydelse: amount(1000),
        tillaeg: undefined,
      }],
    }))).toEqual([]);
  });

  it('advarer, når midlertidigt EET indsættes fra Erhvervsevnetab-siden uden en afgørelse', () => {
    expect(advarselIds(efter2011({ midlertidigtEETAfgorelse: 'Nej', midlertidigtEetFraEetSiden: 'Ja' })))
      .toEqual(['midlertidigtEetKonsistens.ydelerUdenAfgorelse:warning']);
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
