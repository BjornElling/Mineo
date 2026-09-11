import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

const amount = (value: number) => ({ kind: 'number' as const, value });

const emptyRow = (id: string): StandardLoenTableRow => ({
  id,
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  fpFvShSoBeloeb: undefined,
  pensionBeloeb: undefined,
});

const monthRow = (id: string, month: number, year: number, value: number): StandardLoenTableRow => ({
  ...emptyRow(id),
  col0_maaned: String(month),
  col1_maaned: String(year),
  col2: amount(value),
});

const dayRow = (id: string, from: string, to: string, value: number): StandardLoenTableRow => ({
  ...emptyRow(id),
  col0_dag: toISODateString(from),
  col1_dag: toISODateString(to),
  col2: amount(value),
});

const baseValues: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

const values = (overrides: Partial<AarsloenValues>): AarsloenValues => ({
  ...baseValues,
  ...overrides,
});

describe('Årsløn – uafhængigt håndberegnet engine-facit', () => {
  it('Metode A: dagløn omregnes fra 22 hverdage til 228 normarbejdsdage', () => {
    const result = computeAarsloenBeregning({
      values: values({
        loenperiode: LOENPERIODE.DAG,
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
        fuldLoenUnderFerie: false,
        retTilSjetteFerieuge: false,
        antalFeriedage: 0,
        tableData: [dayRow('august', '2024-08-01', '2024-08-31', 11000)],
      }),
      omregningAktiveret: true,
    });

    // August 2024 har 22 hverdage og ingen dansk SH-dag. Håndfacit:
    // 261 normhverdage - 25 feriedage - 8 SH-dage = 228 arbejdsdage;
    // 11.000 kr. / 22 dage * 228 dage = 114.000 kr.
    expect(result.shDageAntal).toBe(0);
    expect(result.beregnetAarsloen).toBe(11000);
    expect(result.beregningsData).toMatchObject({
      metode: 'A',
      erEtAar: false,
      hverdageIPeriode: 22,
      feriedageFraInput: 0,
      arbejdsdageIPeriode: 22,
      feriedagePaaAar: 25,
      arbejdsdagePaaAar: 228,
      omregnetAarsloen: 114000,
      antalEnheder: 31,
      antalHeleKalendermaaneder: null,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });

  it('Metode B: dagløn fratrækker to feriedage i både periode og årsnorm', () => {
    const result = computeAarsloenBeregning({
      values: values({
        loenperiode: LOENPERIODE.DAG,
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
        fuldLoenUnderFerie: false,
        retTilSjetteFerieuge: false,
        antalFeriedage: 2,
        tableData: [dayRow('august', '2024-08-01', '2024-08-31', 10000)],
      }),
      omregningAktiveret: true,
    });

    // Håndfacit: 22 hverdage - 2 feriedage = 20 dage;
    // 261 normhverdage - 25 feriedage = 236 dage;
    // 10.000 kr. / 20 dage * 236 dage = 118.000 kr.
    expect(result.shDageAntal).toBeNull();
    expect(result.beregnetAarsloen).toBe(10000);
    expect(result.beregningsData).toMatchObject({
      metode: 'B',
      erEtAar: false,
      hverdageIPeriode: 22,
      feriedageFraInput: 2,
      arbejdsdageIPeriode: 20,
      feriedagePaaAar: 25,
      hverdagePaaAar: 236,
      omregnetAarsloen: 118000,
      antalEnheder: 31,
      antalHeleKalendermaaneder: null,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });

  it('Metode C: dagløn for to hele kalendermåneder omregnes månedligt', () => {
    const result = computeAarsloenBeregning({
      values: values({
        loenperiode: LOENPERIODE.DAG,
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
        fuldLoenUnderFerie: true,
        tableData: [
          dayRow('januar', '2024-01-01', '2024-01-31', 30000),
          dayRow('februar', '2024-02-01', '2024-02-29', 30000),
        ],
      }),
      omregningAktiveret: true,
    });

    // Håndfacit: 30.000 kr. + 30.000 kr. = 60.000 kr. for to hele måneder;
    // 60.000 kr. / 2 måneder * 12 måneder = 360.000 kr.
    expect(result.shDageAntal).toBeNull();
    expect(result.beregningsFejl).toBeNull();
    expect(result.beregnetAarsloen).toBe(60000);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      erEtAar: false,
      hverdageIPeriode: 44,
      feriedageFraInput: 0,
      arbejdsdageIPeriode: 0,
      antalEnheder: 60,
      antalHeleKalendermaaneder: 2,
      omregnetAarsloen: 360000,
    });
    expect(result.harFatalBeregningsFejl).toBe(false);
  });

  it('Metode C: en eksplicit lønrække på nul giver nul uden fatal fejl', () => {
    const result = computeAarsloenBeregning({
      values: values({
        loenperiode: LOENPERIODE.MAANED,
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
        tableData: [monthRow('januar', 1, 2024, 0)],
      }),
      omregningAktiveret: true,
    });

    expect(result.beregnetAarsloen).toBe(0);
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      erEtAar: false,
      hverdageIPeriode: 23,
      omregnetAarsloen: 0,
      antalEnheder: 1,
      antalHeleKalendermaaneder: null,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });

  it('Metode B: præcis så mange feriedage som periodens hverdage giver nul', () => {
    const result = computeAarsloenBeregning({
      values: values({
        loenperiode: LOENPERIODE.DAG,
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
        fuldLoenUnderFerie: false,
        retTilSjetteFerieuge: false,
        antalFeriedage: 22,
        tableData: [dayRow('august', '2024-08-01', '2024-08-31', 10000)],
      }),
      omregningAktiveret: true,
    });

    // Håndfacit: 22 hverdage - 22 feriedage = 0. Guardens definerede output er 0 kr.
    expect(result.beregningsData).toMatchObject({
      metode: 'B',
      arbejdsdageIPeriode: 0,
      hverdagePaaAar: 236,
      omregnetAarsloen: 0,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
