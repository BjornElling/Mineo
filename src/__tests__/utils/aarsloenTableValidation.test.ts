/// <reference types="vitest/globals" />
import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { AarsloenTableRow } from '../../schemas/formSchemas';
import { getAarsloenTableValidation } from '../../utils/aarsloenTableValidation';
import { isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const row = (id: string, overrides: Partial<AarsloenTableRow>): AarsloenTableRow => ({
  id,
  ...overrides,
});

describe('getAarsloenTableValidation', () => {
  it('flags missing period start when row has other data', () => {
    const rows = [row('r1', { col2: amount(100) })];
    const result = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });
  });

  it('flags missing period end when start is filled', () => {
    const rows = [row('r1', { col0_maaned: '1', col2: amount(100) })];
    const result = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col1_maaned',
      reason: 'missing',
    });
  });

  it('marks input errors as first error when present', () => {
    const rows = [row('r1', { col0_maaned: '13', col1_maaned: '2024' })];
    const result = getAarsloenTableValidation({
      rows,
      loenperiode: 'maaned',
      cellErrorsByCellKey: { 'r1:col0_maaned': true },
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'input',
    });
  });

  it('sets warning when only period is filled', () => {
    const rows = [row('r1', { col0_maaned: '1', col1_maaned: '2024' })];
    const result = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(false);
    expect(result.summary.hasWarnings).toBe(true);
    expect(result.summary.firstErrorCell).toBeUndefined();
  });

  it('does not set warning when amount column is explicitly set to 0', () => {
    const rows = [row('r1', { col0_maaned: '1', col1_maaned: '2024', col2: amount(0) })];
    const result = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(false);
    expect(result.summary.hasWarnings).toBe(false);
  });

  it('skips warnings and reports first error in later rows', () => {
    const rows = [
      row('r1', { col0_maaned: '1', col1_maaned: '2024' }),
      row('r2', { col2: amount(200) }),
    ];
    const result = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r2',
      colKey: 'col0_maaned',
      reason: 'missing',
    });
  });

  it('switches firstErrorCell reason between missing and input as state changes', () => {
    const rows = [row('r1', { col2: amount(100) })];

    const missingResult = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });
    expect(missingResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });

    const inputResult = getAarsloenTableValidation({
      rows,
      loenperiode: 'maaned',
      cellErrorsByCellKey: { 'r1:col0_maaned': true },
    });
    expect(inputResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'input',
    });

    const missingAgainResult = getAarsloenTableValidation({ rows, loenperiode: 'maaned' });
    expect(missingAgainResult.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'col0_maaned',
      reason: 'missing',
    });
  });

  it('treats non-finite numbers as empty', () => {
    expect(isAarsloenTableValueEffectivelyEmptyForValidation(Number.NaN)).toBe(true);
    expect(isAarsloenTableValueEffectivelyEmptyForValidation(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('treats zero values as filled input', () => {
    expect(isAarsloenTableValueEffectivelyEmptyForValidation('0')).toBe(false);
    expect(isAarsloenTableValueEffectivelyEmptyForValidation('0,00')).toBe(false);
    expect(isAarsloenTableValueEffectivelyEmptyForValidation(0)).toBe(false);
    expect(isAarsloenTableValueEffectivelyEmptyForValidation({ kind: 'number', value: 0 })).toBe(false);
    expect(isAarsloenTableValueEffectivelyEmptyForValidation({ kind: 'expression', expression: '0', value: 0 })).toBe(false);
  });
});
