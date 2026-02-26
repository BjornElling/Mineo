import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  adaptSvieSmerteForAggregation,
  adaptOevrigeKravForAggregation,
} from '../../../domain/erstatningsopgoerelse/aggregationAdapters';
import { buildOevrigeKravModel, buildSvieSmerteModel } from '../../../domain/erstatningsopgoerelse/eoPdfBuilders';
import type { SvieSmerteEngineOutput } from '../../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/svieSmerteEngine';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

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

  it('holder parity mellem aggregation-adapter og PDF-total (engine er allerede clampet >= 0)', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-01-10'),
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [
        { id: 'ss-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), tilstand: 'sygemeldt' as const },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmerteTidligereTotal: amount(0),
      svieSmerteAktuelPeriode: amount(0),
    };
    const stamdata = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadesdato: toISODateString('2024-01-01'),
    };

    const engine = computeSvieSmerteEngine({
      erstatningsopgoerelse: eoValues,
      stamdata: {
        skadesdato: stamdata.skadesdato,
        skadestype: stamdata.skadestype,
      },
    });
    const adapted = adaptSvieSmerteForAggregation(engine);
    const pdf = buildSvieSmerteModel(eoValues, stamdata);

    expect(adapted).not.toBeNull();
    expect(adapted?.amount).toBe(pdf.totalOre / 100);
  });
});

// ─── adaptOevrigeKravForAggregation ───────────────────────────────────────

describe('adaptOevrigeKravForAggregation', () => {
  const withRows = (rows: OevrigeKravRow[] | undefined): OevrigeKravRow[] => rows ?? [];

  it('returnerer { amount: 0 } for tom oevrigeKravPerioder', () => {
    // Invariant: tom række-mængde betyder 0-sum (ikke "not calculable") i aggregation.
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
