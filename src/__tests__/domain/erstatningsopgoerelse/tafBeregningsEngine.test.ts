import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeTafEngine } from '../../../domain/erstatningsopgoerelse/tafBeregningsEngine';
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
});
