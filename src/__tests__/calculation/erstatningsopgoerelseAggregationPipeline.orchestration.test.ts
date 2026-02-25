import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../types/branded';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { computeTafEngine } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { computeSvieSmerteEngine } from '../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { logError } from '../../utils/logger';

vi.mock('../../domain/erstatningsopgoerelse/tafBeregningsEngine', () => ({
  computeTafEngine: vi.fn(() => ({ beregningsenhed: 'Måneder', rows: [] })),
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

const mockedComputeTaf = vi.mocked(computeTafEngine);
const mockedComputeSvieSmerte = vi.mocked(computeSvieSmerteEngine);
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
