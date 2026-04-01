import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';
import { parseOevrigeKravBeloeb } from '../../../domain/erstatningsopgoerelse/helpers/oevrigeKravAmountParser';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const parse = (rows: OevrigeKravRow[]) => parseOevrigeKravBeloeb(rows);

describe('parseOevrigeKravBeloeb', () => {
  it('returnerer total 0 for tomme rækker', () => {
    expect(parse([])).toEqual({ rows: [], totalOre: 0 });
  });

  it('filtrerer tomme rækker og summerer øre på fyldte rækker', () => {
    const result = parse([
      { id: 'r1', dato: undefined, udgiftTil: undefined, beloeb: amount(1.23) },
      { id: 'r2', dato: undefined, udgiftTil: undefined, beloeb: undefined },
      { id: 'r3', dato: undefined, udgiftTil: undefined, beloeb: amount(3) },
    ]);

    expect(result).not.toBeNull();
    expect(result?.rows).toHaveLength(2);
    expect(result?.rows.map((row) => row.amountOre)).toEqual([123, 300]);
    expect(result?.totalOre).toBe(423);
  });

  it('returnerer null for ikke-tom række med manglende beløb', () => {
    const result = parse([
      { id: 'r1', dato: '2024-01-01', udgiftTil: undefined, beloeb: undefined },
    ]);
    expect(result).toBeNull();
  });

  it('returnerer null for negativt beløb', () => {
    const result = parse([
      { id: 'r1', dato: undefined, udgiftTil: undefined, beloeb: amount(-1) },
    ]);
    expect(result).toBeNull();
  });

  it('returnerer null for sub-øre precision', () => {
    const result = parse([
      { id: 'r1', dato: undefined, udgiftTil: undefined, beloeb: amount(0.335) },
    ] as unknown as OevrigeKravRow[]);
    expect(result).toBeNull();
  });

  it('summerer store værdier deterministisk', () => {
    const result = parse([
      { id: 'r1', dato: undefined, udgiftTil: undefined, beloeb: amount(500_000) },
      { id: 'r2', dato: undefined, udgiftTil: undefined, beloeb: amount(250_000) },
    ]);
    expect(result?.totalOre).toBe(75_000_000);
  });
});

