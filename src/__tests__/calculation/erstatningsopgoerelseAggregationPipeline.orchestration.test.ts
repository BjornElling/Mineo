import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../types/branded';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { computeTafEngine } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { logError } from '../../utils/logger';

vi.mock('../../domain/erstatningsopgoerelse/tafBeregningsEngine', () => ({
  computeTafEngine: vi.fn(() => ({ beregningsenhed: 'Måneder', rows: [] })),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

const mockedComputeTaf = vi.mocked(computeTafEngine);
const mockedLogError = vi.mocked(logError);

describe('erstatningsopgoerelseAggregationPipeline orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedComputeTaf.mockReturnValue({ beregningsenhed: 'Måneder', rows: [] });
  });

  it('kører ikke TAF-engine for default tom TAF-række', () => {
    const eo = createErstatningsopgoerelseInitialValues();
    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTaf).not.toHaveBeenCalled();
  });

  it('kører ikke TAF-engine når TAF ikke skal beregnes', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Nej' as const,
    };

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTaf).not.toHaveBeenCalled();
  });

  it('returnerer fejl fra snapshot uden tilkoblede computed outputs', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    const result = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('error');
    if (!result || result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'svieSmerte' && error.code === 'missing_computed')).toBe(true);
  });

  it('logger fejl når en delberegning kaster', () => {
    mockedComputeTaf.mockImplementation(() => {
      throw new Error('boom');
    });
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedLogError).toHaveBeenCalledTimes(1);
  });

  it('beregner TAF når der findes mindst én udfyldt TAF-periode', () => {
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesTabtArbejdsfortjeneste: 'Ja' as const,
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2026-01-01'), til: toISODateString('2026-01-31'), loseFeriedage: undefined }],
    };

    computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eo,
    });

    expect(mockedComputeTaf).toHaveBeenCalledTimes(1);
    expect(mockedComputeTaf).toHaveBeenCalledWith({
      erstatningsopgoerelse: eo,
      tafPerioder: eo.tafPerioder,
      ferieperioder: eo.ferieperioder,
    });
  });
});
