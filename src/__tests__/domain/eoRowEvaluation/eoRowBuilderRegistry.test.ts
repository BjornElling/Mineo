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
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';

const makeRow = (id: string, status: EoRowModel['status']): EoRowModel => ({
  id,
  label: id,
  displayValue: id,
  status,
});

const ctx: EoRowEvaluationContext = {
  stamdataValues: STAMDATA_INITIAL_VALUES,
  stamdataErrors: EMPTY_FIELD_ISSUE_SET,
  eoValues: createErstatningsopgoerelseInitialValues(),
  eoErrors: EMPTY_FIELD_ISSUE_SET,
  loenindkomstManuelReguleringInputErrors: {},
  rowPolicy: DEFAULT_APP_SETTINGS,
};

describe('executeEoRowBuilderEntries', () => {
  it('isolerer builder-fejl og returnerer en fejl-række', () => {
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
    expect(rows.some((row) => row.id === 'eo.rowBuilder.aes.exception')).toBe(true);
    const errorRow = rows.find((row) => row.id === 'eo.rowBuilder.aes.exception');
    expect(errorRow?.status).toBe('error');
    expect(errorRow?.displayValue).toContain('Test-fejl');
  });

  it('returnerer rækker grupperet pr. sektion med samme fejl-isolation', () => {
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
        id: 'eo.rowBuilder.taf.exception',
        status: 'error',
        displayValue: expect.stringContaining('Sektion fejlede'),
      }),
    ]);
  });
});
