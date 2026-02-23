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

  it('fails closed on invalid computed values', () => {
    const computedOutputs = {
      rente: { amount: 'invalid' },
      taf: { amount: 10 },
      offset: { amount: 5 },
    } as unknown as Record<string, { amount: unknown }>;

    const result = aggregateErstatningsopgoerelse({
      policy: basePolicy,
      computedOutputs,
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((err) => err.lineId === 'rente' && err.code === 'invalid_computed')).toBe(true);
  });

  it('applies total rounding when configured without per-line rounding', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'onlyTotal', method: 'halfAwayFromZero', precision: 0 },
      lines: [
        { id: 'rente', computedSourceId: 'rente', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive' },
        { id: 'offset', computedSourceId: 'offset', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'negative' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { rente: { amount: 10.4 }, offset: { amount: 0.6 } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.total).toBe(10);
    expect(result.totalRoundingApplied).toBe(true);
  });

  it('when: "perLine" → afrunder per linje men ikke totalen', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'halfAwayFromZero', precision: 2 },
      totalRounding: { when: 'perLine', method: 'none', precision: 0 },
      lines: [
        { id: 'a', computedSourceId: 'a', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive' },
        { id: 'b', computedSourceId: 'b', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { a: { amount: 10.126 }, b: { amount: 20.234 } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0]).toMatchObject({ id: 'a', value: 10.13, roundingApplied: true });
    expect(result.lineItems[1]).toMatchObject({ id: 'b', value: 20.23, roundingApplied: true });
    // Total afrunding IKKE anvendt
    expect(result.totalRoundingApplied).toBe(false);
  });

  it('when: "none" → ingen afrunding hverken per linje eller total', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'halfAwayFromZero', precision: 2 },
      totalRounding: { when: 'none', method: 'halfAwayFromZero', precision: 0 },
      lines: [
        { id: 'a', computedSourceId: 'a', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { a: { amount: 10.456 } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    // lineRounding.method='halfAwayFromZero' men when='none' → applyPerLine=false → ingen linjeafrunding
    expect(result.lineItems[0]).toMatchObject({ value: 10.456, roundingApplied: false });
    expect(result.totalRoundingApplied).toBe(false);
  });

  it('roundingOverride erstatter default lineRounding for den pågældende linje', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'halfAwayFromZero', precision: 2 },
      totalRounding: { when: 'perLine', method: 'none', precision: 0 },
      lines: [
        { id: 'a', computedSourceId: 'a', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive' },
        { id: 'b', computedSourceId: 'b', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive',
          roundingOverride: { method: 'floor', precision: 0 } },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { a: { amount: 10.456 }, b: { amount: 20.999 } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0]).toMatchObject({ value: 10.46, roundingApplied: true }); // default halfAwayFromZero 2dec
    expect(result.lineItems[1]).toMatchObject({ value: 20, roundingApplied: true });    // override floor 0dec
  });

  it('roundingOverride med method=none deaktiverer afrunding for den linje', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'ceil', precision: 0 },
      totalRounding: { when: 'perLine', method: 'none', precision: 0 },
      lines: [
        { id: 'a', computedSourceId: 'a', computedValuePath: 'amount', strategy: 'computedOnly', sign: 'positive',
          roundingOverride: { method: 'none', precision: 0 } },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { a: { amount: 10.123 } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0]).toMatchObject({ value: 10.123, roundingApplied: false });
  });

  it('nested objekt path (dot notation) resolves korrekt', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'none', method: 'none', precision: 0 },
      lines: [
        { id: 'nested', computedSourceId: 'computed', computedValuePath: 'result.breakdown.amount', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { computed: { result: { breakdown: { amount: 500 } } } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0].value).toBe(500);
  });

  it('array bracket notation ([0]) resolves korrekt', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'none', method: 'none', precision: 0 },
      lines: [
        { id: 'arr', computedSourceId: 'computed', computedValuePath: 'items[0].value', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { computed: { items: [{ value: 100 }, { value: 200 }] } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0].value).toBe(100);
  });

  it('dot array notation ([1]) resolves element ved index 1', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'none', method: 'none', precision: 0 },
      lines: [
        { id: 'arr', computedSourceId: 'computed', computedValuePath: 'items[1].amount', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { computed: { items: [{ amount: 10 }, { amount: 20 }, { amount: 30 }] } },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.lineItems[0].value).toBe(20);
  });

  it('out-of-bounds array index → missing_computed fejl', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'none', method: 'none', precision: 0 },
      lines: [
        { id: 'oob', computedSourceId: 'computed', computedValuePath: 'items[10].value', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { computed: { items: [{ value: 100 }] } },
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((e) => e.code === 'missing_computed')).toBe(true);
  });

  it('path til null intermediate → missing_computed fejl', () => {
    const policy = aggregationPolicySchema.parse({
      outputMode: 'lineItems',
      lineRounding: { method: 'none', precision: 0 },
      totalRounding: { when: 'none', method: 'none', precision: 0 },
      lines: [
        { id: 'null_path', computedSourceId: 'computed', computedValuePath: 'result.breakdown.amount', strategy: 'computedOnly', sign: 'positive' },
      ],
    });

    const result = aggregateErstatningsopgoerelse({
      policy,
      computedOutputs: { computed: { result: null } },
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((e) => e.code === 'missing_computed')).toBe(true);
  });
});
