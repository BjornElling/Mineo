import { renderHook } from '@testing-library/react';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { useErstatningsopgoerelseAggregation } from '../../calculation/useErstatningsopgoerelseAggregation';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';

vi.mock('../../hooks/usePersistedSection', () => ({
  usePersistedSection: vi.fn(),
}));

vi.mock('../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline', async () => {
  return {
    computeErstatningsopgoerelseAggregationFromSnapshot: vi.fn(),
  };
});

const mockedUsePersistedSection = vi.mocked(usePersistedSection);
const mockedComputeFromSnapshot = vi.mocked(computeErstatningsopgoerelseAggregationFromSnapshot);

describe('useErstatningsopgoerelseAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const eoValues = createErstatningsopgoerelseInitialValues();
    const stamdataValues = structuredClone(STAMDATA_INITIAL_VALUES);
    mockedUsePersistedSection.mockImplementation((section) => {
      if (section === 'erstatningsopgoerelse') return eoValues;
      if (section === 'stamdata') return stamdataValues;
      return undefined;
    });
    mockedComputeFromSnapshot.mockReturnValue({
      kind: 'error',
      errors: [{ lineId: 'svieSmerte', code: 'missing_computed', message: 'Computed value is required.' }],
    });
  });

  it('videresender snapshot til pipeline-beregning', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const stamdataValues = structuredClone(STAMDATA_INITIAL_VALUES);
    mockedUsePersistedSection.mockImplementation((section) => {
      if (section === 'erstatningsopgoerelse') return eoValues;
      if (section === 'stamdata') return stamdataValues;
      return undefined;
    });

    const { result } = renderHook(() => useErstatningsopgoerelseAggregation(true));

    expect(result.current).not.toBeNull();
    expect(mockedComputeFromSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedComputeFromSnapshot).toHaveBeenCalledWith({
      erstatningsopgoerelse: eoValues,
      stamdata: {
        skadesdato: stamdataValues.skadesdato,
        skadestype: stamdataValues.skadestype,
      },
    });
  });

  it('returnerer null når pipeline returnerer null', () => {
    mockedComputeFromSnapshot.mockReturnValue(null);

    const { result } = renderHook(() => useErstatningsopgoerelseAggregation(true));

    expect(result.current).toBeNull();
  });
});
