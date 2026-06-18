/// <reference types="vitest/globals" />

import { createDate } from '../../../utils/dateUtils';
import { buildSHDageTableRows } from '../../../document/generators/aarsloen/shDageDocument';

describe('buildSHDageTableRows', () => {
  it('placerer totalen i SH-dag-kolonnen', () => {
    const { body, totalRowIndex, totalValueColumnIndex } = buildSHDageTableRows([
      {
        dato: createDate(2024, 0, 1),
        ugedag: 'Mandag',
        helligdagNavn: 'Nytårsdag',
        erHverdag: true,
      },
      {
        dato: createDate(2024, 2, 28),
        ugedag: 'Torsdag',
        helligdagNavn: 'Skærtorsdag',
        erHverdag: true,
      },
    ]);

    expect(totalRowIndex).toBe(3);
    expect(totalValueColumnIndex).toBe(3);

    const totalRow = body[totalRowIndex!] as Array<{ content?: string; colSpan?: number }>;
    expect(totalRow).toHaveLength(4);

    const labelCell = totalRow[0];
    const emptyCell1 = totalRow[1];
    const emptyCell2 = totalRow[2];
    const valueCell = totalRow[3];

    expect(typeof labelCell).toBe('object');
    expect(labelCell).toMatchObject({
      content: 'SH-dage i alt',
    });

    expect(typeof emptyCell1).toBe('object');
    expect(emptyCell1).toMatchObject({ content: '' });

    expect(typeof emptyCell2).toBe('object');
    expect(emptyCell2).toMatchObject({ content: '' });

    expect(typeof valueCell).toBe('object');
    expect(valueCell).toMatchObject({
      content: '2',
      colSpan: 1,
    });
  });

  it('udelader totalrækken når der kun er én helligdag', () => {
    const { body, totalRowIndex } = buildSHDageTableRows([
      {
        dato: createDate(2024, 0, 1),
        ugedag: 'Mandag',
        helligdagNavn: 'Nytårsdag',
        erHverdag: true,
      },
    ]);

    expect(body).toHaveLength(2);
    expect(totalRowIndex).toBeNull();
  });
});
