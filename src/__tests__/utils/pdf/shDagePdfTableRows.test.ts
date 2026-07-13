/// <reference types="vitest/globals" />

import { createDate } from '../../../utils/dateUtils';
import { buildSHDageTableRows } from '../../../document/generators/aarsloen/shDageDocument';

describe('buildSHDageTableRows', () => {
  it('placerer totalen i SH-dag-kolonnen', () => {
    const { rows } = buildSHDageTableRows([
      { dato: createDate(2024, 0, 1), ugedag: 'Mandag', helligdagNavn: 'Nytårsdag', erHverdag: true },
      { dato: createDate(2024, 2, 28), ugedag: 'Torsdag', helligdagNavn: 'Skærtorsdag', erHverdag: true },
    ]);

    // header + 2 datarækker + 1 total = 4 rækker; totalrækken er sidst.
    expect(rows).toHaveLength(4);
    const totalRow = rows[3];
    expect(totalRow.kind).toBe('total');
    const cells = totalRow.cells;
    expect(cells).toHaveLength(4);
    expect(cells[0]).toMatchObject({ text: 'SH-dage i alt' });
    expect(cells[1]).toMatchObject({ text: '' });
    expect(cells[2]).toMatchObject({ text: '' });
    expect(cells[3]).toMatchObject({ text: '2', colSpan: 1, separatorAbove: true });
  });

  it('udelader totalrækken når der kun er én helligdag', () => {
    const { rows } = buildSHDageTableRows([
      { dato: createDate(2024, 0, 1), ugedag: 'Mandag', helligdagNavn: 'Nytårsdag', erHverdag: true },
    ]);

    // Kun header + 1 datarække; ingen total.
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.kind === 'total')).toBe(false);
  });
});
