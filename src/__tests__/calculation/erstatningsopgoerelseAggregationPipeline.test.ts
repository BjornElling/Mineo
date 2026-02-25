import type { TafEngineOutput } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import {
  computeErstatningsopgoerelseAggregation,
  computeErstatningsopgoerelseAggregationFromSnapshot,
} from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const buildTafOutput = (): TafEngineOutput => ({
  beregningsenhed: 'Måneder',
  rows: [{ id: 't1', value: 200 }],
});

const buildComputedAmount = (amount: number): AggregatableComputed => ({ amount });

describe('erstatningsopgoerelseAggregationPipeline', () => {
  it('fails closed when required computed outputs are missing', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildTafOutput(),
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'svieSmerte' && error.code === 'missing_computed')).toBe(true);
  });

  it('aggregates taf + svieSmerte + oevrigeKrav and applies total rounding', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
      oevrigeKravPerioder: [
        { id: 'k1', dato: '2024-01-01', udgiftTil: 'Test', beloeb: { kind: 'number', value: 15 } },
      ],
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildTafOutput(),
      svieSmerteOutput: buildComputedAmount(5),
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    // 200 + 5 + 15 = 220
    expect(result.total).toBe(220);
  });

  it('computes aggregation from committed snapshot via pipeline orchestrator', () => {
    const result = computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
    });

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('ok');
  });

  it('fails closed when oevrige krav amount cannot be parsed', () => {
    const manualValues = {
      ...createErstatningsopgoerelseInitialValues(),
      oevrigeKravPerioder: [{ id: 'k1', dato: '2024-01-01', udgiftTil: 'Test', beloeb: undefined }],
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      tafOutput: buildTafOutput(),
      svieSmerteOutput: buildComputedAmount(5),
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'oevrigeKrav' && error.code === 'missing_computed')).toBe(true);
  });
});
