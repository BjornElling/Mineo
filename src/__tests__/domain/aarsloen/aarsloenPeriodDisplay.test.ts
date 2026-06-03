import type { DateInterval, AarsloenBeregningResultBeregnet } from '../../../types/calculation';
import type { PeriodeResult } from '../../../utils/periodeBeregning';
import { resolveAarsloenIndtastetEnhedSummary } from '../../../domain/aarsloen/aarsloenPeriodDisplay';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const buildPeriodeResult = (unikkeEnheder: number, perioder: DateInterval[] = []): PeriodeResult => ({
  periodeTekst: 'test',
  totalEnheder: unikkeEnheder,
  unikkeEnheder,
  enhedNavn: 'dage',
  datoSet: new Set(),
  perioder,
});

const buildRow = (overrides: Partial<StandardLoenTableRow> = {}): StandardLoenTableRow => ({
  id: 'row-1',
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
  ...overrides,
});

const baseBeregnet: AarsloenBeregningResultBeregnet = {
  metode: 'A',
  erEtAar: false,
  hverdageIPeriode: 0,
  feriedageFraInput: 0,
  arbejdsdageIPeriode: 0,
  feriedagePaaAar: 0,
  arbejdsdagePaaAar: 0,
  hverdagePaaAar: 0,
  omregnetAarsloen: 0,
  antalEnheder: 0,
  antalHeleKalendermaaneder: null,
};

describe('resolveAarsloenIndtastetEnhedSummary', () => {
  it('viser hverdage for metode A, selv når beregningsgrundlaget er arbejdsdage', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [],
      periodeData: buildPeriodeResult(51),
      beregningsData: { ...baseBeregnet, metode: 'A', arbejdsdageIPeriode: 37, hverdageIPeriode: 9 },
      loenperiode: 'dag',
    });

    expect(result).toEqual({
      label: 'Antal hverdage i de indtastede perioder',
      value: '9 hverdage',
    });
  });

  it('viser hverdage for metode B', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [],
      periodeData: buildPeriodeResult(51),
      beregningsData: { ...baseBeregnet, metode: 'B', arbejdsdageIPeriode: 42 },
      loenperiode: 'dag',
    });

    expect(result).toEqual({
      label: 'Antal hverdage i de indtastede perioder',
      value: '42 hverdage',
    });
  });

  it('viser måneder for metode C med månedsløn', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [],
      periodeData: buildPeriodeResult(3),
      beregningsData: { ...baseBeregnet, metode: 'C', antalEnheder: 3 },
      loenperiode: 'maaned',
    });

    expect(result).toEqual({
      label: 'Antal måneder i de indtastede perioder',
      value: '3 måneder',
    });
  });

  it('falder tilbage til kalenderdage når metode endnu ikke er afgjort', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [],
      periodeData: buildPeriodeResult(51),
      beregningsData: { metode: 'ingen', erEtAar: false },
      loenperiode: 'dag',
    });

    expect(result).toEqual({
      label: 'Antal kalenderdage i de indtastede perioder',
      value: '51 kalenderdage',
    });
  });

  it('viser entalslabel når der kun er én indtastet periode', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [buildRow({ col0_dag: toISODateString('2024-01-01') })],
      periodeData: buildPeriodeResult(1, [{ start: new Date(toISODateString('2024-01-01')), end: new Date(toISODateString('2024-01-31')) }]),
      beregningsData: { ...baseBeregnet, metode: 'A', arbejdsdageIPeriode: 1, hverdageIPeriode: 3 },
      loenperiode: 'dag',
    });

    expect(result).toEqual({
      label: 'Antal hverdage i den indtastede periode',
      value: '3 hverdage',
    });
  });

  it('beholder flertalslabel når flere rækker er udfyldt selv om perioden samler til én periode', () => {
    const result = resolveAarsloenIndtastetEnhedSummary({
      tableData: [
        buildRow({ id: 'row-1', col0_dag: toISODateString('2024-01-01') }),
        buildRow({ id: 'row-2', col0_dag: toISODateString('2024-01-02') }),
      ],
      periodeData: buildPeriodeResult(19, [{ start: new Date(toISODateString('2024-01-01')), end: new Date(toISODateString('2024-01-31')) }]),
      beregningsData: { ...baseBeregnet, metode: 'A', arbejdsdageIPeriode: 19, hverdageIPeriode: 24 },
      loenperiode: 'dag',
    });

    expect(result).toEqual({
      label: 'Antal hverdage i de indtastede perioder',
      value: '24 hverdage',
    });
  });
});
