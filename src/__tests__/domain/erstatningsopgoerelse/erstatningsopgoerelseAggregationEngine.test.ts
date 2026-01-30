import { aggregationPolicySchema } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy';
import { aggregateErstatningsopgoerelse } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';

const basePolicy = aggregationPolicySchema.parse({
  outputMode: 'lineItems',
  lineRounding: { method: 'halfAwayFromZero', precision: 2 },
  totalRounding: { when: 'perLineThenTotal', method: 'halfAwayFromZero', precision: 2 },
  lines: [
    {
      id: 'rente',
      computedSourceId: 'rente',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
    {
      id: 'taf',
      computedSourceId: 'taf',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
    {
      id: 'offset',
      computedSourceId: 'offset',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'negative',
    },
  ],
});

describe('erstatningsopgoerelseAggregationEngine', () => {
  it('applies computed-only policy, sign, and rounding', () => {
    const computedOutputs = {
      rente: { amount: 123.456 },
      taf: { amount: 10 },
      offset: { amount: 0.005 },
    };

    const result = aggregateErstatningsopgoerelse({
      policy: basePolicy,
      computedOutputs,
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems).toEqual([
      { id: 'rente', value: 123.46, source: 'computed', roundingApplied: true },
      { id: 'taf', value: 10, source: 'computed', roundingApplied: true },
      { id: 'offset', value: -0.01, source: 'computed', roundingApplied: true },
    ]);
    expect(result.total).toBe(133.45);
    expect(result.totalRoundingApplied).toBe(true);
  });

  it('fails closed when required computed value is missing', () => {
    const computedOutputs = { taf: { amount: 10 } };

    const result = aggregateErstatningsopgoerelse({
      policy: basePolicy,
      computedOutputs,
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((err) => err.lineId === 'rente' && err.code === 'missing_computed')).toBe(true);
  });

  it('is deterministic for identical snapshots', () => {
    const input = {
      policy: basePolicy,
      computedOutputs: {
        rente: { amount: 100 },
        taf: { amount: 10 },
        offset: { amount: 1.005 },
      },
    };

    const cloned = JSON.parse(JSON.stringify(input)) as typeof input;
    const first = aggregateErstatningsopgoerelse(input);
    const second = aggregateErstatningsopgoerelse(cloned);

    expect(first).toEqual(second);
  });
});
