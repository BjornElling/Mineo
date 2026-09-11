import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const values: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.DAG,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
  tableData: [
    {
      id: 'august-ikke-hel',
      col0_maaned: '',
      col1_maaned: '',
      col0_uge: '',
      col1_uge: '',
      col0_dag: toISODateString('2024-08-01'),
      col1_dag: toISODateString('2024-08-30'),
      col2: amount(11_000),
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
  ],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: false,
  antalFeriedage: 0,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

describe('Årsløn – uafhængigt facit for daglønnes hverdagsfallback', () => {
  it('bruger hverdagsomregning for en daglønperiode, der ikke er en hel kalendermåned', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // 1.–30. august 2024 har 22 hverdage. Håndfacit for fallbacken:
    // 11.000 kr. / 22 hverdage × 261 normhverdage = 130.500 kr.
    expect(result.beregnetAarsloen).toBe(11_000);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      erEtAar: false,
      hverdageIPeriode: 22,
      arbejdsdageIPeriode: 22,
      hverdagePaaAar: 261,
      feriedageFraInput: 0,
      antalEnheder: 30,
      antalHeleKalendermaaneder: null,
      omregnetAarsloen: 130_500,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
