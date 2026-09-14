import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const values: AarsloenValues = {
  feriePct: 1,
  fritvalgPct: 2,
  shSoPct: 3,
  storeBededagPct: 4,
  pensionPct: 5,
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
  tableData: [{
    id: 'januar-2024-beloeb',
    col0_maaned: '1',
    col1_maaned: '2024',
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(17_400),
    col3: amount(1_600),
    col4: amount(900),
    col5: amount(125),
    fpFvShSoBeloeb: amount(2_750),
    pensionBeloeb: amount(1_325),
  }],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

describe('CALC-002 – uafhængigt facit for direkte tillægsbeløb', () => {
  it('summerer beløbstilstandens seks lønkolonner og omregner én måned til et år', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // Håndfacit: 17.400 + 1.600 + 900 + 125 + 2.750 + 1.325 = 24.100 kr.;
    // én måned omregnes til 24.100 / 1 × 12 = 289.200 kr. De udfyldte procentsatser
    // skal være uden virkning, fordi tillæggene angives direkte som beløb.
    expect(result.beregnetAarsloen).toBe(24_100);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      erEtAar: false,
      antalEnheder: 1,
      hverdageIPeriode: 23,
      omregnetAarsloen: 289_200,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
