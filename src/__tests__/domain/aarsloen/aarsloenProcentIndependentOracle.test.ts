import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE } from '../../../types/loen';

const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

describe('Årsløn – uafhængigt procentfacit gennem beregningsindgangen', () => {
  it('summerer procentbaserede tillæg med særskilt pensions- og ATP-grundlag', () => {
    const values: AarsloenValues = {
      feriePct: 12.5,
      fritvalgPct: 4,
      shSoPct: 2,
      storeBededagPct: 0.5,
      pensionPct: 10,
      loenperiode: LOENPERIODE.MAANED,
      tillaegAngivesSom: 'procent',
      tableData: [
        {
          id: 'procent-facit',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: amount(20_000),
          col3: amount(3_000),
          col4: amount(1_000),
          col5: amount(250),
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

    const result = computeAarsloenBeregning({ values, omregningAktiveret: false });

    // Håndfacit: grundløn = 20.000 + 3.000 = 23.000 kr.;
    // tillægsgrundlag = 23.000 + 1.000 = 24.000 kr.;
    // 12,5 % + 4 % + 2 % + 0,5 % = 19 % → 24.000 × 0,19 = 4.560 kr.;
    // pension = 23.000 × 1,19 × 10 % = 2.737 kr.;
    // samlet = 24.000 + 4.560 + 2.737 + 250 = 31.547 kr.
    expect(result.beregnetAarsloen).toBe(31_547);
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
