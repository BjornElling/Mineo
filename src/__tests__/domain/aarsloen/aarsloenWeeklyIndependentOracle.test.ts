import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const values: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.UGE,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [
    {
      id: 'weekly-facit',
      col0_maaned: '',
      col1_maaned: '',
      col0_uge: '1/2024',
      col1_uge: '10/2024',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: amount(100_000),
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

describe('Årsløn – uafhængigt ugefacit gennem beregningsindgangen', () => {
  it('omregner 10 ugers samlet løn på 100.000 kr. til 521.400 kr. om året', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // Håndfacit: 100.000 kr. / 10 uger × 52,14 uger pr. år = 521.400 kr.
    expect(result.beregnetAarsloen).toBe(100_000);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      erEtAar: false,
      antalEnheder: 10,
      omregnetAarsloen: 521_400,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
