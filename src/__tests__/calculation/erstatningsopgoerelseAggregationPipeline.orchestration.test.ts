import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../types/branded';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { computeSvieSmerteEngine } from '../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { computeTafNettoBeregning } from '../../domain/erstatningsopgoerelse/tafNettoBeregning';
import { logError } from '../../utils/logger';

vi.mock('../../domain/erstatningsopgoerelse/tafNettoBeregning', () => ({
  computeTafNettoBeregning: vi.fn(() => ({
    harTafPerioder: true,
    tafBeregningsenhed: 'Måneder',
    indkomstSkadestidspunkt: null,
    loenudvikling: null,
    tafIndtaegter: null,
    tidligereModtagetTaf: { status: 'not_calculable', reason: 'Ikke angivet' },
    tabtArbejdsfortjenesteOre: 0,
  })),
}));
vi.mock('../../domain/erstatningsopgoerelse/svieSmerteEngine', () => ({
  computeSvieSmerteEngine: vi.fn(() => ({
    constrainedPeriods: [],
    harInputPerioder: false,
    harPerioder: false,
    opgjortFremTilPeriodeTil: false,
    satserAar: null,
    satserPerDagOre: null,
    satserMaxOre: null,
    forligLabel: null,
    tidligereOre: null,
    aktuelOre: null,
    sygedage: 0,
    delviseSygedage: 0,
    delvisFaktor: 0.5,
    maxApplied: false,
    totalOre: 0,
  })),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

const mockedComputeSvieSmerte = vi.mocked(computeSvieSmerteEngine);
const mockedComputeTafNetto = vi.mocked(computeTafNettoBeregning);
const mockedLogError = vi.mocked(logError);

describe('erstatningsopgoerelseAggregationPipeline orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedComputeTafNetto.mockReturnValue({
      harTafPerioder: true,
      tafBeregningsenhed: 'Måneder',
      indkomstSkadestidspunkt: null,
      loenudvikling: null,
      tafIndtaegter: null,
      tidligereModtagetTaf: { status: 'not_calculable', reason: 'Ikke angivet' },
      tabtArbejdsfortjenesteOre: 0,
    });
  });

  it('kører ikke TAF-netto-beregning for default tom TAF-række', () => {
    const eo = createErstatningsopgoerelseInitialValues();
    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTafNetto).not.toHaveBeenCalled();
  });

  it('kører ikke TAF-netto-beregning når TAF ikke skal beregnes', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Nej' as const,
    };

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTafNetto).not.toHaveBeenCalled();
  });

  it('returnerer ok fra snapshot når taf/svieSmerte/oevrigeKrav kan udledes', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    const result = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('ok');
  });

  it('logger fejl når en delberegning kaster', () => {
    mockedComputeTafNetto.mockImplementation(() => {
      throw new Error('boom');
    });
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    const result = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedLogError).toHaveBeenCalledTimes(1);
    expect(result?.kind).toBe('error');
    if (!result || result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'taf' && error.code === 'missing_computed')).toBe(true);
  });

  it('beregner TAF-netto når der findes mindst én udfyldt TAF-periode', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTafNetto).toHaveBeenCalledTimes(1);
    expect(mockedComputeTafNetto).toHaveBeenCalledWith(expect.objectContaining(eo), expect.any(Object));
  });

  it('videresender stamdata til svieSmerte-engine når snapshot indeholder stamdata', () => {
    const eo = createErstatningsopgoerelseInitialValues();

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
      stamdata: {
        skadesdato: toISODateString('2020-01-01'),
        skadestype: 'Arbejdsulykke',
      },
    });

    expect(mockedComputeSvieSmerte).toHaveBeenCalledTimes(1);
    expect(mockedComputeSvieSmerte).toHaveBeenCalledWith({
      erstatningsopgoerelse: eo,
      stamdata: {
        skadesdato: toISODateString('2020-01-01'),
        skadestype: 'Arbejdsulykke',
      },
    });
  });
});
