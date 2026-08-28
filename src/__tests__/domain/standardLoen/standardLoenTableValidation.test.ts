/// <reference types="vitest/globals" />
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import {
  getStandardLoenTableValidation,
  isStandardLoenTableValueEffectivelyEmptyForValidation,
} from '../../../domain/standardLoen/standardLoenTableValidation';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const row = (id: string, overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id,
  ...overrides,
});

describe('getStandardLoenTableValidation', () => {
  it('flags missing period start when row has other data', () => {
    const rows = [row('r1', { col2: amount(100) })];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      emptyCompletePeriodLevel: 'error',
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });
  });

  it('flags missing period end when start is filled', () => {
    const rows = [row('r1', { col0_maaned: '1', col2: amount(100) })];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      emptyCompletePeriodLevel: 'error',
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col1_maaned',
      reason: 'missing',
    });
  });

  it('marks input errors as first error when present', () => {
    const rows = [row('r1', { col0_maaned: '13', col1_maaned: '2024' })];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      cellErrorsByCellKey: { 'r1:0': true },
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'input',
    });
  });

  it('sætter fejl på første beløbsfelt når kun perioden er udfyldt', () => {
    const rows = [row('r1', { col0_maaned: '1', col1_maaned: '2024' })];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      emptyCompletePeriodLevel: 'error',
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.hasWarnings).toBe(false);
    expect(result.summary.firstErrorCell).toEqual({ rowId: 'r1', colKey: 'col2', reason: 'missing' });
    expect(result.errors).toContainEqual({ kind: 'cell', issue: 'missing_amount', rowId: 'r1', colKey: 'col2' });
  });

  it('does not set warning when amount column is explicitly set to 0', () => {
    const rows = [row('r1', { col0_maaned: '1', col1_maaned: '2024', col2: amount(0) })];
    const result = getStandardLoenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(false);
    expect(result.summary.hasWarnings).toBe(false);
  });

  it('rapporterer den første manglende værdi i tabelrækkefølgen', () => {
    const rows = [
      row('r1', { col0_maaned: '1', col1_maaned: '2024' }),
      row('r2', { col2: amount(200) }),
    ];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      emptyCompletePeriodLevel: 'error',
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col2',
      reason: 'missing',
    });
  });

  it('switches firstErrorCell reason between missing and input as state changes', () => {
    const rows = [row('r1', { col2: amount(100) })];

    const missingResult = getStandardLoenTableValidation({ rows, loenperiode: 'maaned' });
    expect(missingResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });

    const inputResult = getStandardLoenTableValidation({
      rows,
      loenperiode: 'maaned',
      cellErrorsByCellKey: { 'r1:0': true },
    });
    expect(inputResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'input',
    });

    const missingAgainResult = getStandardLoenTableValidation({ rows, loenperiode: 'maaned' });
    expect(missingAgainResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });
  });

  it('treats non-finite numbers as empty', () => {
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation(Number.NaN)).toBe(true);
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('treats zero values as filled input', () => {
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation('0')).toBe(false);
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation('0,00')).toBe(false);
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation(0)).toBe(false);
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation({ kind: 'number', value: 0 })).toBe(false);
    expect(isStandardLoenTableValueEffectivelyEmptyForValidation({ kind: 'expression', expression: '0', value: 0 })).toBe(false);
  });

  it('fortolker numerisk cellKey som kanonisk tabelcelle-identitet', () => {
    const rows = [row('r1', { col0_dag: toISODateString('2024-01-01'), col1_dag: toISODateString('2024-01-31'), col3: amount(100) })];
    const result = getStandardLoenTableValidation({
      rows,
      loenperiode: 'dag',
      cellErrorsByCellKey: { 'r1:3': true },
    });

    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col3',
      reason: 'input',
    });
  });
});
