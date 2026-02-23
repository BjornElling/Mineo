import { describe, expect, it } from 'vitest';
import type { ISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import {
  adaptRenteForAggregation,
  adaptTafForAggregation,
  adaptVarigtMenForAggregation,
  adaptOevrigeKravForAggregation,
} from '../../../domain/erstatningsopgoerelse/aggregationAdapters';
import type { RenteberegningOutput } from '../../../domain/renteberegning/renteberegningEngine';
import type { TafEngineOutput } from '../../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { VarigeMenEngineOutput } from '../../../domain/varigemen/varigeMenEngine';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const iso = (s: string): ISODateString => s as ISODateString;
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const initialEoValues = createErstatningsopgoerelseInitialValues();
const makeEoValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...structuredClone(initialEoValues),
  ...patch,
});

// ─── adaptRenteForAggregation ─────────────────────────────────────────────

describe('adaptRenteForAggregation', () => {
  const makeRenteOutput = (rows: Array<{ id: string; calculatedInterest: number | null }>): RenteberegningOutput => ({
    rows: rows.map((r) => ({
      id: r.id,
      actualInterestDate: iso('2024-01-01'),
      calculatedInterest: r.calculatedInterest,
    })),
  });

  it('summer alle renter', () => {
    const output = makeRenteOutput([
      { id: 'r1', calculatedInterest: 1000 },
      { id: 'r2', calculatedInterest: 500 },
    ]);
    expect(adaptRenteForAggregation(output)).toEqual({ amount: 1500 });
  });

  it('returnerer null ved én null-rente', () => {
    const output = makeRenteOutput([
      { id: 'r1', calculatedInterest: 1000 },
      { id: 'r2', calculatedInterest: null },
    ]);
    expect(adaptRenteForAggregation(output)).toBeNull();
  });

  it('returnerer { amount: 0 } for tom liste', () => {
    const output = makeRenteOutput([]);
    expect(adaptRenteForAggregation(output)).toEqual({ amount: 0 });
  });

  it('returnerer { amount: 0 } for enkelt row med 0', () => {
    const output = makeRenteOutput([{ id: 'r1', calculatedInterest: 0 }]);
    expect(adaptRenteForAggregation(output)).toEqual({ amount: 0 });
  });

  it('returnerer null ved NaN-rente', () => {
    const output: RenteberegningOutput = {
      rows: [{ id: 'r1', actualInterestDate: iso('2024-01-01'), calculatedInterest: NaN }],
    };
    expect(adaptRenteForAggregation(output)).toBeNull();
  });

  it('returnerer null ved Infinity-rente', () => {
    const output: RenteberegningOutput = {
      rows: [{ id: 'r1', actualInterestDate: iso('2024-01-01'), calculatedInterest: Infinity }],
    };
    expect(adaptRenteForAggregation(output)).toBeNull();
  });

  it('summer korrekt med negative beløb', () => {
    const output = makeRenteOutput([
      { id: 'r1', calculatedInterest: 2000 },
      { id: 'r2', calculatedInterest: -500 },
    ]);
    expect(adaptRenteForAggregation(output)).toEqual({ amount: 1500 });
  });

  it('summer korrekt med store beløb', () => {
    const output = makeRenteOutput([
      { id: 'r1', calculatedInterest: 1_000_000 },
      { id: 'r2', calculatedInterest: 999_999.99 },
    ]);
    const result = adaptRenteForAggregation(output);
    expect(result?.amount).toBeCloseTo(1_999_999.99, 2);
  });

  it('null første i listen → returnerer null (rækkefølge ligegyldig)', () => {
    const output = makeRenteOutput([
      { id: 'r1', calculatedInterest: null },
      { id: 'r2', calculatedInterest: 1000 },
      { id: 'r3', calculatedInterest: 500 },
    ]);
    expect(adaptRenteForAggregation(output)).toBeNull();
  });
});

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

// ─── adaptVarigtMenForAggregation ─────────────────────────────────────────

describe('adaptVarigtMenForAggregation', () => {
  const makeVarigtMenOutput = (godtgoerelse: number | null): VarigeMenEngineOutput => ({
    result: godtgoerelse === null
      ? null
      : {
          beregnetGodtgoerelse: godtgoerelse,
          grundbeloeb: 100000,
          satsPerMengrad: 1000,
          aldersreduktionPct: 0,
          grundbeloebUdenReduktion: godtgoerelse,
          alderVedSkade: 30,
        },
  });

  it('returnerer amount fra beregnetGodtgoerelse', () => {
    expect(adaptVarigtMenForAggregation(makeVarigtMenOutput(50000))).toEqual({ amount: 50000 });
  });

  it('returnerer null når result er null', () => {
    expect(adaptVarigtMenForAggregation(makeVarigtMenOutput(null))).toBeNull();
  });

  it('returnerer null ved NaN', () => {
    const output: VarigeMenEngineOutput = {
      result: {
        beregnetGodtgoerelse: NaN,
        grundbeloeb: 100000,
        satsPerMengrad: 1000,
        aldersreduktionPct: 0,
        grundbeloebUdenReduktion: 10000,
        alderVedSkade: 30,
      },
    };
    expect(adaptVarigtMenForAggregation(output)).toBeNull();
  });

  it('returnerer null ved Infinity', () => {
    const output: VarigeMenEngineOutput = {
      result: {
        beregnetGodtgoerelse: Infinity,
        grundbeloeb: 100000,
        satsPerMengrad: 1000,
        aldersreduktionPct: 0,
        grundbeloebUdenReduktion: 10000,
        alderVedSkade: 30,
      },
    };
    expect(adaptVarigtMenForAggregation(output)).toBeNull();
  });

  it('returnerer { amount: 0 } for 0 godtgørelse', () => {
    expect(adaptVarigtMenForAggregation(makeVarigtMenOutput(0))).toEqual({ amount: 0 });
  });

  it('returnerer negativ amount for negativ godtgørelse', () => {
    expect(adaptVarigtMenForAggregation(makeVarigtMenOutput(-50_000))).toEqual({ amount: -50_000 });
  });
});

// ─── adaptOevrigeKravForAggregation ───────────────────────────────────────

describe('adaptOevrigeKravForAggregation', () => {
  it('returnerer { amount: 0 } for tom oevrigeKravPerioder', () => {
    const eo = makeEoValues({ oevrigeKravPerioder: [] });
    expect(adaptOevrigeKravForAggregation(eo)).toEqual({ amount: 0 });
  });

  it('summer beløb fra ikke-tomme rækker', () => {
    const eo = makeEoValues({
      oevrigeKravPerioder: [
        { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
        { id: 'r2', beloeb: amount(2500), dato: undefined, udgiftTil: undefined },
      ],
    });
    expect(adaptOevrigeKravForAggregation(eo)).toEqual({ amount: 3500 });
  });

  it('ignorerer tomme rækker (alle non-id felter undefined)', () => {
    const eo = makeEoValues({
      oevrigeKravPerioder: [
        { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
        { id: 'r2', beloeb: undefined, dato: undefined, udgiftTil: undefined }, // tom
      ],
    });
    // r2 er tom → ignoreres. r1 har beloeb = 1000.
    expect(adaptOevrigeKravForAggregation(eo)).toEqual({ amount: 1000 });
  });

  it('returnerer null når en ikke-tom række har udefinerbart beloeb', () => {
    // amountValueToNumber returnerer undefined for undefined → sumFinite returnerer null
    const eo = makeEoValues({
      oevrigeKravPerioder: [
        { id: 'r1', beloeb: amount(1000), dato: undefined, udgiftTil: undefined },
        { id: 'r2', beloeb: undefined, dato: iso('2024-01-01'), udgiftTil: undefined }, // ikke tom (dato sat), men beloeb undefined
      ],
    });
    expect(adaptOevrigeKravForAggregation(eo)).toBeNull();
  });

  it('returnerer { amount: 0 } for undefined oevrigeKravPerioder', () => {
    const eo = makeEoValues({ oevrigeKravPerioder: undefined });
    expect(adaptOevrigeKravForAggregation(eo)).toEqual({ amount: 0 });
  });

  it('returnerer korrekt sum ved store beløb', () => {
    const eo = makeEoValues({
      oevrigeKravPerioder: [
        { id: 'r1', beloeb: amount(500_000), dato: undefined, udgiftTil: undefined },
        { id: 'r2', beloeb: amount(250_000), dato: undefined, udgiftTil: undefined },
      ],
    });
    expect(adaptOevrigeKravForAggregation(eo)).toEqual({ amount: 750_000 });
  });
});
