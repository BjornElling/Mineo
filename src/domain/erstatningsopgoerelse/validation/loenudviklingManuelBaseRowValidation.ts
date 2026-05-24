import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';
import { isWithinTolerance } from '../../../utils/numberComparison';
import { formatPercentDisplay } from '../../../utils/percentDraftCore';

export type ManualBaseRowPercentField = 'feriepenge' | 'fritvalg' | 'shSoSats' | 'agPension';

export type ManualBaseRowCellErrors = Partial<Record<ManualBaseRowPercentField, string>>;

type ExpectedSatser = Readonly<{
  feriePct: number | null | undefined;
  fritvalgPct: number | null | undefined;
  shSoPct: number | null | undefined;
  pensionPct: number | null | undefined;
}>;

const parseCommittedPercent = (value: number | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const formatExpectedPercent = (value: number): string => {
  return `${formatPercentDisplay(value, true)} %`;
};

const hasMismatch = (actual: number | undefined, expected: number | null | undefined): boolean => {
  const actualValue = actual ?? 0;
  const expectedValue = expected ?? 0;
  // 0,01 procentpoint er en bevidst valideringstolerance for afrundede procentvisninger.
  return !isWithinTolerance(actualValue, expectedValue, 0.01);
};

export const validateLoenudviklingManualBaseRowSatser = (
  baseRow: LoenudviklingManuelRow | undefined,
  expectedSatser: ExpectedSatser
): ManualBaseRowCellErrors => {
  const errors: ManualBaseRowCellErrors = {};

  const checks: ReadonlyArray<{
    field: ManualBaseRowPercentField;
    expected: number | null | undefined;
    actual: number | undefined;
  }> = [
    {
      field: 'feriepenge',
      expected: expectedSatser.feriePct,
      actual: parseCommittedPercent(baseRow?.feriepenge),
    },
    {
      field: 'fritvalg',
      expected: expectedSatser.fritvalgPct,
      actual: parseCommittedPercent(baseRow?.fritvalg),
    },
    {
      field: 'shSoSats',
      expected: expectedSatser.shSoPct,
      actual: parseCommittedPercent(baseRow?.shSoSats),
    },
    {
      field: 'agPension',
      expected: expectedSatser.pensionPct,
      actual: parseCommittedPercent(baseRow?.agPension),
    },
  ];

  for (const check of checks) {
    if (hasMismatch(check.actual, check.expected)) {
      errors[check.field] = `Værdien er ovenfor angivet til ${formatExpectedPercent(check.expected ?? 0)}`;
    }
  }

  return errors;
};
