import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const values: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [
    {
      id: 'januar-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 10_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
    {
      id: 'februar-2024',
      col0_maaned: '2',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 10_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
    {
      id: 'marts-2024',
      col0_maaned: '3',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 10_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
  ],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

describe('Årsløn – uafhængigt facit for månedsløn gennem beregningsindgangen', () => {
  it('omregner tre månedsløn-rækker på 10.000 kr. til 120.000 kr. om året', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // Håndfacit: 3 × 10.000 kr. = 30.000 kr.; 30.000 kr. / 3 måneder × 12 = 120.000 kr.
    expect(result.beregnetAarsloen).toBe(30_000);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      antalEnheder: 3,
      hverdageIPeriode: 65,
      omregnetAarsloen: 120_000,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
