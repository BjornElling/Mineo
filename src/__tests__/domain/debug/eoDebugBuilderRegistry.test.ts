import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { EoRowEvaluationContext } from '../../../domain/eoRowEvaluation/eoRowExecutionContext';
import type { EoRowBuilderEntry } from '../../../domain/eoRowEvaluation/eoRowBuilderRegistry';
import {
  executeEoRowBuilderEntries,
  executeEoRowBuilderEntriesBySection,
} from '../../../domain/eoRowEvaluation/eoRowBuilderRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

const makeRow = (id: string, status: EoRowModel['status']): EoRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
});

const ctx: EoRowEvaluationContext = {
  stamdataValues: STAMDATA_INITIAL_VALUES,
  stamdataErrors: {},
  eoValues: createErstatningsopgoerelseInitialValues(),
  eoErrors: {},
  loenindkomstManuelReguleringInputErrors: {},
  appSettings: DEFAULT_APP_SETTINGS,
};

describe('executeEoRowBuilderEntries', () => {
  it('isolates builder exceptions and returns an error row', () => {
    const entries: EoRowBuilderEntry[] = [
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

    const rows = executeEoRowBuilderEntries(entries, ctx);

    expect(rows.some((row) => row.id === 'stamdata.journalnr')).toBe(true);
    expect(rows.some((row) => row.id === 'debug.builder.aes.exception')).toBe(true);
    const errorRow = rows.find((row) => row.id === 'debug.builder.aes.exception');
    expect(errorRow?.status).toBe('error');
    expect(errorRow?.displayValue).toContain('Test-fejl');
  });

  it('returns rows grouped by section with the same exception isolation', () => {
    const entries: EoRowBuilderEntry[] = [
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

    const rowsBySection = executeEoRowBuilderEntriesBySection(entries, ctx);

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
