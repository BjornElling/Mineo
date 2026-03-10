import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeTafArbejdsdageAggregation, computeTafEngine } from '../../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';
import type { TafPeriodeRow } from '../../../schemas/formSchemas';

const normalizeOutput = (rows: ReadonlyArray<{ id: string; value: number | null }>) => {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
};

const initialEoValues = createErstatningsopgoerelseInitialValues();

const baseValues = () => ({
  ...initialEoValues,
});

describe('tafBeregningsEngine', () => {
  it('computes month-based values for beregningsperiode', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toEqual([{ id: 'row-1', value: 1 }]);
  });

  it('ignores øvrigt fravær uden løn in TAF-perioder (ingen fradrag i kravet)', () => {
    const values = {
      ...baseValues(),
      oevrigtFravaerUdenLoen: 'Ja' as const,
      oevrigeFravaersdage: 1,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 1,
      },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows[0]?.value).toBe(1);
  });

  it('computes arbejdsdage when beregnesUdFra forces dagsloen', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 0,
      },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toEqual([{ id: 'row-1', value: 5 }]);
  });

  it('returns null for rows with missing dates', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: undefined,
        til: toISODateString('2024-01-10'),
        loseFeriedage: 0,
      },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toEqual([{ id: 'row-1', value: null }]);
  });

  it('does not double-subtract overlapping ferieperioder', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 0,
      },
    ];

    const ferieperioder = [
      { id: 'ferie-1', fra: toISODateString('2024-02-06'), til: toISODateString('2024-02-07') },
      { id: 'ferie-2', fra: toISODateString('2024-02-07'), til: toISODateString('2024-02-08') },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder,
    });

    expect(output.rows).toEqual([{ id: 'row-1', value: 2 }]);
  });

  it('is deterministic for identical input snapshots', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      },
    ];

    const snapshot = {
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    };

    const cloned = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    const first = computeTafEngine(snapshot);
    const second = computeTafEngine(cloned);

    expect(first).toEqual(second);
  });

  it('is order-independent for taf periods', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 0,
      },
      {
        id: 'row-2',
        fra: toISODateString('2024-03-04'),
        til: toISODateString('2024-03-08'),
        loseFeriedage: 0,
      },
    ];

    const outputA = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    const outputB = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder: [...tafPerioder].reverse(),
      ferieperioder: [],
    });

    expect(normalizeOutput(outputA.rows)).toEqual(normalizeOutput(outputB.rows));
  });

  it('sammenlaegger overlap og tilstødende TAF-perioder i beregningen', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 0,
      },
      {
        id: 'row-2',
        fra: toISODateString('2024-02-10'),
        til: toISODateString('2024-02-12'),
        loseFeriedage: 0,
      },
      {
        id: 'row-3',
        fra: toISODateString('2024-02-08'),
        til: toISODateString('2024-02-14'),
        loseFeriedage: 0,
      },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]?.value).toBe(8);
  });

  it('aggregates TAF hverdage when beregningsenhed is måneder', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2025-08-01'),
        til: toISODateString('2026-01-31'),
        loseFeriedage: 0,
      },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    });

    expect(aggregated).toBe(131);
  });

  it('aggregates TAF-dage when beregningsenhed is arbejdsdage', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 1,
      },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
    });

    expect(aggregated).toBe(4);
  });

  it('bruger autoritative clampede tafRanges i aggregation uden at flytte loseFeriedage vaek fra den oprindelige raekke', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: toISODateString('2024-02-05'),
      vedroererPeriodeTil: toISODateString('2024-02-12'),
    };
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: toISODateString('2024-02-05'), til: toISODateString('2024-02-09'), loseFeriedage: 1 },
      { id: 'row-2', fra: toISODateString('2024-02-10'), til: toISODateString('2024-02-12'), loseFeriedage: 2 },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tafRanges: [{ fra: toISODateString('2024-02-05'), til: toISODateString('2024-02-12') }],
    });

    expect(aggregated).toBe(4);
  });

  it('returnerer null fra aggregation når alle TAF-rækker er ugyldige', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: undefined, til: toISODateString('2024-01-10'), loseFeriedage: 0 },
      { id: 'row-2', fra: toISODateString('2024-01-31'), til: toISODateString('2024-01-01'), loseFeriedage: 0 },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    });

    expect(aggregated).toBeNull();
  });

  it('returnerer tom rows-liste for ingen TAF-perioder', () => {
    const output = computeTafEngine({
      erstatningsopgoerelse: baseValues(),
      tafPerioder: [],
      ferieperioder: [],
    });
    expect(output.rows).toEqual([]);
  });

  it('bevarer loseFeriedage paa den oprindelige raekke ved overlap i stedet for at genplacere dem paa den merged periode', () => {
    // Row 1: 2024-02-05 til 2024-02-09 -> 5 hverdage, 2 loseFeriedage => 3 arbejdsdage
    // Row 2: 2024-02-08 til 2024-02-14 -> 5 hverdage, 3 loseFeriedage => arbejdsdage {13,14}
    // Union paa merged perioden 2024-02-05 til 2024-02-14 => {07,08,09,13,14} = 5 arbejdsdage
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: toISODateString('2024-02-05'), til: toISODateString('2024-02-09'), loseFeriedage: 2 },
      { id: 'row-2', fra: toISODateString('2024-02-08'), til: toISODateString('2024-02-14'), loseFeriedage: 3 },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]?.value).toBe(5);
  });

  it('invalide rækker inkluderes i output med value=null og nulstillet loseFeriedage', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'invalid', fra: undefined, til: toISODateString('2024-01-10'), loseFeriedage: 5 },
      { id: 'valid', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: 0 },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toHaveLength(2);
    const invalid = output.rows.find((r) => r.id === 'invalid');
    const valid = output.rows.find((r) => r.id === 'valid');
    expect(invalid?.value).toBeNull();
    expect(valid?.value).toBe(1);
  });

  it('bounds clamping eliminerer perioder der ikke overlapper med vedroererPeriode', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: toISODateString('2024-03-01'),
      vedroererPeriodeTil: toISODateString('2024-03-31'),
    };
    // TAF-periode er helt før vedroererPeriode → clamped bort
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: 0 },
    ];

    const output = computeTafEngine({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
    });

    expect(output.rows).toEqual([]);
  });
});
