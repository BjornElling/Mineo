import { renderHook } from '@testing-library/react';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { useErstatningsopgoerelseAggregation } from '../../calculation/useErstatningsopgoerelseAggregation';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { computeTafEngine } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { computeErstatningsopgoerelseAggregation } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';

vi.mock('../../hooks/usePersistedSection', () => ({
  usePersistedSection: vi.fn(),
}));

vi.mock('../../domain/erstatningsopgoerelse/tafBeregningsEngine', () => ({
  computeTafEngine: vi.fn(),
}));

vi.mock('../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline', async () => {
  const actual = await vi.importActual<typeof import('../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline')>(
    '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline'
  );
  return {
    ...actual,
    computeErstatningsopgoerelseAggregation: vi.fn(actual.computeErstatningsopgoerelseAggregation),
  };
});

const mockedUsePersistedSection = vi.mocked(usePersistedSection);
const mockedComputeTafEngine = vi.mocked(computeTafEngine);
const mockedComputeAggregation = vi.mocked(computeErstatningsopgoerelseAggregation);

describe('useErstatningsopgoerelseAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const eoValues = createErstatningsopgoerelseInitialValues();
    mockedUsePersistedSection.mockImplementation((section) => {
      if (section === 'stamdata') return STAMDATA_INITIAL_VALUES;
      if (section === 'erstatningsopgoerelse') return eoValues;
      return undefined;
    });
  });

  it('fejler lukket når TAF-beregning kaster', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedComputeTafEngine.mockImplementation(() => {
      throw new Error('Test-fejl i TAF');
    });

    const { result } = renderHook(() => useErstatningsopgoerelseAggregation(true));

    expect(result.current).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Beregning afbrudt (taf):'), expect.any(Error));
    warnSpy.mockRestore();
  });

  it('returnerer null når samlet aggregation kaster', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedComputeAggregation.mockImplementation(() => {
      throw new Error('Test-fejl i aggregation');
    });

    const { result } = renderHook(() => useErstatningsopgoerelseAggregation(true));

    expect(result.current).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Beregning afbrudt (erstatningsopgoerelse-aggregation):'),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
