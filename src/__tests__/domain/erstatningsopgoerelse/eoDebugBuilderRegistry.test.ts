import type { DebugRowModel } from '../../../domain/debug/eoDebugTypes';
import type { EODebugExecutionContext } from '../../../domain/erstatningsopgoerelse/eoDebugExecutionContext';
import type { EODebugBuilderEntry } from '../../../domain/erstatningsopgoerelse/eoDebugBuilderRegistry';
import { executeEODebugBuilderEntries } from '../../../domain/erstatningsopgoerelse/eoDebugBuilderRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const makeRow = (id: string, status: DebugRowModel['status']): DebugRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
});

const ctx: EODebugExecutionContext = {
  stamdataValues: STAMDATA_INITIAL_VALUES,
  stamdataErrors: {},
  eoValues: ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
  eoErrors: {},
};

describe('executeEODebugBuilderEntries', () => {
  it('isolates builder exceptions and returns an error row', () => {
    const entries: EODebugBuilderEntry[] = [
      {
        section: 'stamdata',
        run: () => [makeRow('stamdata.journalnr', 'ok')],
      },
      {
        section: 'aes',
        run: () => {
          throw new Error('Test-fejl');
        },
      },
    ];

    const rows = executeEODebugBuilderEntries(entries, ctx);

    expect(rows.some((row) => row.id === 'stamdata.journalnr')).toBe(true);
    expect(rows.some((row) => row.id === 'debug.builder.aes.exception')).toBe(true);
    const errorRow = rows.find((row) => row.id === 'debug.builder.aes.exception');
    expect(errorRow?.status).toBe('error');
    expect(errorRow?.displayValue).toContain('Test-fejl');
  });
});
