/// <reference types="vitest/globals" />

import { createDate } from '../../../utils/dateUtils';
import { buildSHDageTableRows } from '../../../document/generators/aarsloen/shDageDocument';

type TotalRowLike = { __total?: true; row: Array<{ content?: string; colSpan?: number }>; valueColumnIndex?: number };

describe('buildSHDageTableRows', () => {
  it('placerer totalen i SH-dag-kolonnen', () => {
    const { rows } = buildSHDageTableRows([
      { dato: createDate(2024, 0, 1), ugedag: 'Mandag', helligdagNavn: 'Nytårsdag', erHverdag: true },
      { dato: createDate(2024, 2, 28), ugedag: 'Torsdag', helligdagNavn: 'Skærtorsdag', erHverdag: true },
    ]);

    // header + 2 datarækker + 1 total = 4 rækker; totalrækken er sidst.
    expect(rows).toHaveLength(4);
    const totalRow = rows[3] as TotalRowLike;
    expect(totalRow.__total).toBe(true);
    // Totalen placeres i SH-dag-kolonnen (kolonneindeks 3).
    expect(totalRow.valueColumnIndex).toBe(3);

    const cells = totalRow.row;
    expect(cells).toHaveLength(4);
    expect(cells[0]).toMatchObject({ content: 'SH-dage i alt' });
    expect(cells[1]).toMatchObject({ content: '' });
    expect(cells[2]).toMatchObject({ content: '' });
    expect(cells[3]).toMatchObject({ content: '2', colSpan: 1 });
  });

  it('udelader totalrækken når der kun er én helligdag', () => {
    const { rows } = buildSHDageTableRows([
      { dato: createDate(2024, 0, 1), ugedag: 'Mandag', helligdagNavn: 'Nytårsdag', erHverdag: true },
    ]);

    // Kun header + 1 datarække; ingen total.
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => '__total' in row)).toBe(false);
  });
});
