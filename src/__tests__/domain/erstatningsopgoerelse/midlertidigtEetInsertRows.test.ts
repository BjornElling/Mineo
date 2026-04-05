import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { buildMidlertidigtEetRowsFromEet } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { isoToDanish } from '../../../types/branded';

const makeValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: '2026-03-19',
  skadelidteFodselsdato: '1980-01-01',
  aslAarsloen: { kind: 'number', value: 600000 },
  aslAfgoerelser: [
    {
      id: 'row-1',
      afgoerelsesDato: '01-02-2026',
      virkningsDato: '01-02-2026',
      eetPct: '15',
      kapDato: '',
      kapPct: '',
      afgoerelseType: 'Midlertidig',
      tidlKapDato: '',
    },
    {
      id: 'row-2',
      afgoerelsesDato: '12-03-2026',
      virkningsDato: '12-03-2026',
      eetPct: '20',
      kapDato: '12-03-2026',
      kapPct: '5',
      afgoerelseType: 'Delvist endelig',
      tidlKapDato: '',
    },
    {
      id: 'row-3',
      afgoerelsesDato: '20-03-2026',
      virkningsDato: '20-03-2026',
      eetPct: '25',
      kapDato: '',
      kapPct: '',
      afgoerelseType: 'Endelig',
      tidlKapDato: '',
    },
  ],
});

describe('buildMidlertidigtEetRowsFromEet', () => {
  it('bygger én EO-række per løbende ydelseslinje for midlertidige og delvist endelige afgørelser', () => {
    const eetValues = makeValues();
    const rows = buildMidlertidigtEetRowsFromEet({
      eetValues,
      skadedato: '2024-07-01',
    });
    const computation = computeEetLoebendeYdelser({
      erhvervsevnetab: eetValues,
      skadedato: '2024-07-01',
      skadelidteFodselsdato: eetValues.skadelidteFodselsdato,
    }).computation;

    expect(computation).not.toBeNull();
    const expectedPerioder = computation!.afgoerelser
      .filter((afgoerelse) => afgoerelse.afgoerelseType === 'Midlertidig' || afgoerelse.afgoerelseType === 'Delvist endelig')
      .flatMap((afgoerelse) => afgoerelse.perioder);

    expect(rows).toHaveLength(expectedPerioder.length);
    expect(rows).toEqual(
      expectedPerioder.map((periode, index) => ({
        id: rows[index]!.id,
        fraDato: isoToDanish(periode.fra),
        tilDato: isoToDanish(periode.til),
        ydelse: { kind: 'number', value: periode.beregnetEet },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      }))
    );
  });

  it('indsætter periodetotalbeløbet uændret og ikke som et afledt dagsbeløb', () => {
    const eetValues = makeValues();
    const rows = buildMidlertidigtEetRowsFromEet({
      eetValues,
      skadedato: '2024-07-01',
    });
    const computation = computeEetLoebendeYdelser({
      erhvervsevnetab: eetValues,
      skadedato: '2024-07-01',
      skadelidteFodselsdato: eetValues.skadelidteFodselsdato,
    }).computation;

    expect(computation).not.toBeNull();
    const expectedPerioder = computation!.afgoerelser
      .filter((afgoerelse) => afgoerelse.afgoerelseType === 'Midlertidig' || afgoerelse.afgoerelseType === 'Delvist endelig')
      .flatMap((afgoerelse) => afgoerelse.perioder);

    expect(rows.map((row) => row.ydelse?.kind === 'number' ? row.ydelse.value : undefined)).toEqual(
      expectedPerioder.map((periode) => periode.beregnetEet)
    );
  });

  it('returnerer tomt resultat når der ikke findes indsatbare perioder', () => {
    const values = makeValues();
    values.aslAfgoerelser = [
      {
        id: 'row-1',
        afgoerelsesDato: '',
        virkningsDato: '',
        eetPct: '',
        kapDato: '',
        kapPct: '',
        afgoerelseType: undefined,
        tidlKapDato: '',
      },
    ];

    const rows = buildMidlertidigtEetRowsFromEet({
      eetValues: values,
      skadedato: '2024-07-01',
    });

    expect(rows).toEqual([]);
  });
});
