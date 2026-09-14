import { buildOffentligeYdelserStatusRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstModel';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

describe('CALC-006 – uafhængigt facit for samlet ydelsesstatus', () => {
  it('samler to beløbsfrie perioder og fastholder den første kildesrækkes id', () => {
    const rows: readonly OffentligeYdelserRow[] = [
      {
        id: 'dagpenge-periode-1',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-01-05'),
        ydelse: undefined,
        tillaeg: undefined,
        ydelsestype: 'dagpenge',
      },
      {
        id: 'dagpenge-periode-2',
        fraDato: iso('2024-02-01'),
        tilDato: iso('2024-02-05'),
        ydelse: undefined,
        tillaeg: undefined,
        ydelsestype: 'dagpenge',
      },
    ];

    const statusRows = buildOffentligeYdelserStatusRows(rows);

    expect(statusRows).toHaveLength(1);
    expect(statusRows[0]).toEqual({
      id: 'ydelsestype-dagpenge',
      label: 'Dagpenge',
      status: 'warning',
      message: 'Beløb er ikke angivet (2 perioder)',
      summaryDisplay: 'messageOnly',
      sourceRowId: 'dagpenge-periode-1',
    });
  });
});
