import { buildOffentligeYdelserStatusRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstModel';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

describe('CALC-006 – uafhængigt facit for samlet ydelsesstatus', () => {
  // BB-291: hver beløbsfri periode får sin egen linje med rækkens navn og link til beløbscellen – før blev de
  // samlet til «Beløb er ikke angivet (2 perioder)» uden at sige hvilke.
  it('giver hver beløbsfri periode sin egen linje med rækkens periode', () => {
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

    expect(statusRows).toEqual([
      {
        id: 'dagpenge-periode-1.udenBeloeb',
        label: 'Dagpenge',
        status: 'warning',
        message: 'Ydelsen Dagpenge 01-01-2024 - 05-01-2024: Beløb er ikke angivet',
        summaryDisplay: 'messageOnly',
        sourceRowId: 'dagpenge-periode-1',
        focusColKey: 'ydelse',
      },
      {
        id: 'dagpenge-periode-2.udenBeloeb',
        label: 'Dagpenge',
        status: 'warning',
        message: 'Ydelsen Dagpenge 01-02-2024 - 05-02-2024: Beløb er ikke angivet',
        summaryDisplay: 'messageOnly',
        sourceRowId: 'dagpenge-periode-2',
        focusColKey: 'ydelse',
      },
    ]);
  });
});
