import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';
import { formatPercentFixed2 } from '../pdf/sharedPdfUtils';

export type ManualBaseRowPercentField = 'feriepenge' | 'fritvalg' | 'shSoSats' | 'agPension';

export type ManualBaseRowCellErrors = Partial<Record<ManualBaseRowPercentField, string>>;

type ExpectedSatser = Readonly<{
  feriePct: number | null | undefined;
  fritvalgPct: number | null | undefined;
  shSoPct: number | null | undefined;
  pensionPct: number | null | undefined;
}>;

const parseCommittedPercent = (value: string | undefined): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const normalizeComparablePercent = (value: number | null | undefined): number => {
  return typeof value === 'number' ? value : 0;
};

const hasMismatch = (actual: number | undefined, expected: number | null | undefined): boolean => {
  const normalizedActual = normalizeComparablePercent(actual);
  const normalizedExpected = normalizeComparablePercent(expected);
  return Math.abs(normalizedActual - normalizedExpected) > 0.01;
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
      errors[check.field] = `Værdien er ovenfor angivet til ${formatPercentFixed2(normalizeComparablePercent(check.expected))}`;
    }
  }

  return errors;
};
