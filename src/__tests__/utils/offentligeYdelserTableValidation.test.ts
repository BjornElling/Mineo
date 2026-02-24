/// <reference types="vitest/globals" />
import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../schemas/formSchemas';
import { initialOffentligYdelseRow } from '../../utils/eoConverters';
import {
  getOffentligeYdelserTableValidation,
  isOffentligeYdelserAmountValueValidForValidation,
  isOffentligeYdelserTableValueEffectivelyEmptyForValidation,
} from '../../utils/offentligeYdelserTableValidation';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const row = (id: string, overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  ...initialOffentligYdelseRow,
  id,
  ...overrides,
});

describe('getOffentligeYdelserTableValidation', () => {
  it('flags missing fra/til when row has other data', () => {
    const rows = [row('r1', { ydelse: amount(100) })];
    const result = getOffentligeYdelserTableValidation({ rows });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'fraDato',
      reason: 'missing',
    });
  });

  it('flags missing tilDato when fraDato is filled', () => {
    const rows = [row('r1', { fraDato: '01-01-2024', ydelse: amount(100) })];
    const result = getOffentligeYdelserTableValidation({ rows });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'tilDato',
      reason: 'missing',
    });
  });

  it('flags missing ydelsestype when dates are filled', () => {
    const rows = [row('r1', { fraDato: '01-01-2024', tilDato: '31-01-2024', ydelse: amount(100) })];
    const result = getOffentligeYdelserTableValidation({ rows });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'ydelsestype',
      reason: 'missing',
    });
  });

  it('marks warning when dates + ydelsestype are filled but amounts are empty', () => {
    const rows = [row('r1', { fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'flextilskud' })];
    const result = getOffentligeYdelserTableValidation({ rows });

    expect(result.summary.hasErrors).toBe(false);
    expect(result.summary.hasWarnings).toBe(true);
    expect(result.summary.firstErrorCell).toBeUndefined();
  });

  it('marks input errors as first error when present', () => {
    const rows = [row('r1', { fraDato: 'xx', tilDato: '31-01-2024', ydelsestype: 'flextilskud' })];
    const result = getOffentligeYdelserTableValidation({
      rows,
      cellErrorsByCellKey: { 'r1:fraDato': true },
    });

    expect(result.summary.hasErrors).toBe(true);
    expect(result.summary.firstErrorCell).toEqual({
      rowId: 'r1',
      colKey: 'fraDato',
      reason: 'input',
    });
  });

  it('treats zero amounts as udfyldt for validation', () => {
    const rows = [
      row('r1', { ydelse: amount(0) }),
      row('r2', { fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'flextilskud', ydelse: amount(0) }),
    ];
    const result = getOffentligeYdelserTableValidation({ rows });

    const issuesByRow = new Map(result.summary.rowIssues.map((issue) => [issue.rowId, issue]));
    expect(issuesByRow.get('r1')?.level).toBe('error');
    expect(issuesByRow.get('r1')?.reason).toBe('missing');
    expect(issuesByRow.get('r2')).toBeUndefined();
  });

  it('treats zero-like strings as empty', () => {
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('0')).toBe(true);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('0,')).toBe(true);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('0.')).toBe(true);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('0,00')).toBe(true);
  });

  it('treats expression zeros as udfyldt', () => {
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation({ kind: 'expression', expression: '0', value: 0 })).toBe(false);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation({ kind: 'expression', expression: '0,00', value: 0 })).toBe(false);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation({ kind: 'expression', expression: '0.', value: 0 })).toBe(false);
  });

  it('treats non-finite numbers as empty', () => {
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(Number.NaN)).toBe(true);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('treats finite numbers as udfyldt', () => {
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(0)).toBe(false);
    expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(1)).toBe(false);
  });

  it('marks non-finite amount values as invalid', () => {
    expect(isOffentligeYdelserAmountValueValidForValidation({ kind: 'number', value: Number.NaN })).toBe(false);
    expect(isOffentligeYdelserAmountValueValidForValidation({ kind: 'expression', value: Number.POSITIVE_INFINITY, expression: '1' })).toBe(false);
  });

  it('marks zero amount values as valid', () => {
    expect(isOffentligeYdelserAmountValueValidForValidation({ kind: 'number', value: 0 })).toBe(true);
    expect(isOffentligeYdelserAmountValueValidForValidation({ kind: 'expression', value: 0, expression: '0' })).toBe(true);
  });
});
