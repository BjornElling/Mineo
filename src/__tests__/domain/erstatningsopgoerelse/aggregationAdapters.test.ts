import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  adaptSvieSmerteForAggregation,
  adaptTafForAggregation,
  adaptOevrigeKravForAggregation,
} from '../../../domain/erstatningsopgoerelse/aggregationAdapters';
import { buildOevrigeKravModel } from '../../../domain/erstatningsopgoerelse/eoPdfBuilders';
import type { TafEngineOutput } from '../../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { SvieSmerteEngineOutput } from '../../../domain/erstatningsopgoerelse/svieSmerteEngine';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

// ─── adaptTafForAggregation ───────────────────────────────────────────────

describe('adaptTafForAggregation', () => {
  const makeTafOutput = (rows: Array<{ id: string; value: number | null }>): TafEngineOutput => ({
    rows,
  });

  it('summer alle taf-værdier', () => {
    const output = makeTafOutput([
      { id: 'r1', value: 5000 },
      { id: 'r2', value: 3000 },
    ]);
    expect(adaptTafForAggregation(output)).toEqual({ amount: 8000 });
  });

  it('returnerer null ved én null-taf', () => {
    const output = makeTafOutput([
      { id: 'r1', value: 5000 },
      { id: 'r2', value: null },
    ]);
    expect(adaptTafForAggregation(output)).toBeNull();
  });

  it('returnerer { amount: 0 } for tom liste', () => {
    const output = makeTafOutput([]);
    expect(adaptTafForAggregation(output)).toEqual({ amount: 0 });
  });

  it('returnerer { amount: 0 } for enkelt row med 0', () => {
    const output = makeTafOutput([{ id: 'r1', value: 0 }]);
    expect(adaptTafForAggregation(output)).toEqual({ amount: 0 });
  });

  it('returnerer null ved NaN', () => {
    const output = makeTafOutput([{ id: 'r1', value: NaN }]);
    expect(adaptTafForAggregation(output)).toBeNull();
  });

  it('returnerer null ved Infinity', () => {
    const output = makeTafOutput([{ id: 'r1', value: Infinity }]);
    expect(adaptTafForAggregation(output)).toBeNull();
  });
});

// ─── adaptSvieSmerteForAggregation ────────────────────────────────────────

describe('adaptSvieSmerteForAggregation', () => {
  const makeSvieOutput = (totalOre: number): SvieSmerteEngineOutput => ({
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
    totalOre,
  });

  it('konverterer ore til kroner', () => {
    expect(adaptSvieSmerteForAggregation(makeSvieOutput(250000))).toEqual({ amount: 2500 });
  });

  it('returnerer null ved ikke-heltal i ore', () => {
    expect(adaptSvieSmerteForAggregation(makeSvieOutput(12.5))).toBeNull();
  });
});

// ─── adaptOevrigeKravForAggregation ───────────────────────────────────────

describe('adaptOevrigeKravForAggregation', () => {
  const withRows = (rows: OevrigeKravRow[] | undefined): OevrigeKravRow[] => rows ?? [];

  it('returnerer { amount: 0 } for tom oevrigeKravPerioder', () => {
    expect(adaptOevrigeKravForAggregation(withRows([]))).toEqual({ amount: 0 });
  });

  it('summer beløb fra ikke-tomme rækker', () => {
    const rows = withRows([
      { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
      { id: 'r2', beloeb: amount(2500), dato: undefined, udgiftTil: undefined },
    ]);
    expect(adaptOevrigeKravForAggregation(rows)).toEqual({ amount: 3500 });
  });

  it('ignorerer tomme rækker (alle non-id felter undefined)', () => {
    const rows = withRows([
      { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
      { id: 'r2', beloeb: undefined, dato: undefined, udgiftTil: undefined }, // tom
    ]);
    // r2 er tom → ignoreres. r1 har beloeb = 1000.
    expect(adaptOevrigeKravForAggregation(rows)).toEqual({ amount: 1000 });
  });

  it('returnerer null når en ikke-tom række har udefinerbart beloeb', () => {
    // amountValueToNumber returnerer undefined for undefined → fail-closed
    const rows = withRows([
      { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
      { id: 'r2', beloeb: undefined, dato: '2024-01-01', udgiftTil: undefined }, // ikke tom (dato sat), men beloeb undefined
    ]);
    expect(adaptOevrigeKravForAggregation(rows)).toBeNull();
  });

  it('returnerer { amount: 0 } for undefined oevrigeKravPerioder', () => {
    expect(adaptOevrigeKravForAggregation(withRows(undefined))).toEqual({ amount: 0 });
  });

  it('returnerer korrekt sum ved store beløb', () => {
    const rows = withRows([
      { id: 'r1', beloeb: amount(500_000), dato: undefined, udgiftTil: undefined },
      { id: 'r2', beloeb: amount(250_000), dato: undefined, udgiftTil: undefined },
    ]);
    expect(adaptOevrigeKravForAggregation(rows)).toEqual({ amount: 750_000 });
  });

  it('fejler fail-closed for sub-øre precision', () => {
    const rows = withRows([
      { id: 'r1', beloeb: { kind: 'number', value: 0.335 }, dato: undefined, udgiftTil: undefined },
      { id: 'r2', beloeb: { kind: 'number', value: 0.335 }, dato: undefined, udgiftTil: undefined },
    ] as unknown as OevrigeKravRow[]);
    expect(adaptOevrigeKravForAggregation(rows)).toBeNull();
  });

  it('holder eksplicit parity mellem aggregation og pdf-total i øre', () => {
    const sets: OevrigeKravRow[][] = [
      [],
      [
        { id: 'r1', beloeb: amount(1234.5), dato: '2024-01-01', udgiftTil: 'Test' },
        { id: 'r2', beloeb: amount(10), dato: '2024-02-01', udgiftTil: 'Andet' },
      ],
      [
        { id: 'r1', beloeb: amount(1000), dato: '2024-03-01', udgiftTil: 'Udgift' },
        { id: 'r2', beloeb: undefined, dato: undefined, udgiftTil: undefined },
      ],
    ];

    for (const rows of sets) {
      const aggregation = adaptOevrigeKravForAggregation(rows);
      const pdf = buildOevrigeKravModel(rows);
      expect(aggregation).not.toBeNull();
      expect(aggregation?.amount).toBe(pdf.totalOre / 100);
    }
  });
});
