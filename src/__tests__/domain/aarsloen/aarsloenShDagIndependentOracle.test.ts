import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

const values: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.DAG,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
  tableData: [{
    id: 'april-2023-sh-dage',
    col0_maaned: '',
    col1_maaned: '',
    col0_uge: '',
    col1_uge: '',
    col0_dag: toISODateString('2023-04-01'),
    col1_dag: toISODateString('2023-04-30'),
    col2: { kind: 'number', value: 10_000 },
    col3: undefined,
    col4: undefined,
    col5: undefined,
    fpFvShSoBeloeb: undefined,
    pensionBeloeb: undefined,
  } satisfies StandardLoenTableRow],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: false,
  retTilSjetteFerieuge: false,
  antalFeriedage: 0,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
};

describe('CALC-002 – uafhængigt facit for faktiske SH-dage i Metode A', () => {
  it('fratrækker tre april-helligdage fra både periodens arbejdsdage og årsomregningen', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // April 2023 har 20 hverdage. Skærtorsdag, Langfredag og Anden påskedag er tre
    // SH-dage i perioden: 20 - 3 = 17 arbejdsdage. Håndfacit for årsomregningen:
    // 261 - 25 ferie - 8 norm-SH = 228 arbejdsdage; 10.000 / 17 × 228 = 134.117,647...
    expect(result.shDageAntal).toBe(3);
    expect(result.beregnetAarsloen).toBe(10_000);
    expect(result.beregningsData).toMatchObject({
      metode: 'A',
      erEtAar: false,
      hverdageIPeriode: 20,
      feriedageFraInput: 0,
      arbejdsdageIPeriode: 17,
      feriedagePaaAar: 25,
      arbejdsdagePaaAar: 228,
      omregnetAarsloen: 134_117.64705882352,
      antalEnheder: 30,
      antalHeleKalendermaaneder: null,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
