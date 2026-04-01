import type { DebugRowModel } from '../../../domain/debug/eoDebugTypes';
import type { EODebugExecutionContext } from '../../../domain/debug/eoDebugExecutionContext';
import type { EODebugBuilderEntry } from '../../../domain/debug/eoDebugBuilderRegistry';
import {
  executeEODebugBuilderEntries,
  executeEODebugBuilderEntriesBySection,
} from '../../../domain/debug/eoDebugBuilderRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const makeRow = (id: string, status: DebugRowModel['status']): DebugRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
});

const ctx: EODebugExecutionContext = {
  stamdataValues: STAMDATA_INITIAL_VALUES,
  stamdataErrors: {},
  eoValues: createErstatningsopgoerelseInitialValues(),
  eoErrors: {},
  loenindkomstManuelReguleringInputErrors: {},
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

  it('returns rows grouped by section with the same exception isolation', () => {
    const entries: EODebugBuilderEntry[] = [
      {
        section: 'stamdata',
        run: () => [makeRow('stamdata.journalnr', 'ok')],
      },
      {
        section: 'taf',
        run: () => {
          throw new Error('Sektion fejlede');
        },
      },
    ];

    const rowsBySection = executeEODebugBuilderEntriesBySection(entries, ctx);

    expect(rowsBySection.get('stamdata')).toEqual([makeRow('stamdata.journalnr', 'ok')]);
    expect(rowsBySection.get('taf')).toEqual([
      expect.objectContaining({
        id: 'debug.builder.taf.exception',
        status: 'error',
        displayValue: expect.stringContaining('Sektion fejlede'),
      }),
    ]);
  });
});
