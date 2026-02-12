import { describe, expect, it } from 'vitest';
import { IntegrityInvariant, type IntegrityIssue } from '../eoDebugTypes';
import { maxDebugStatusFromIntegrityIssues, toDebugStatusRank } from '../eoDebugSeverity';

describe('eoDebugSeverity', () => {
  it('returns rank in expected order', () => {
    expect(toDebugStatusRank('ok')).toBe(0);
    expect(toDebugStatusRank('warning')).toBe(1);
    expect(toDebugStatusRank('error')).toBe(2);
  });

  it('returns max debug status from integrity issues', () => {
    const issues: IntegrityIssue[] = [
      {
        severity: 'warning',
        invariant: IntegrityInvariant.DATE_HOLES,
        message: 'warning issue',
      },
      {
        severity: 'error',
        invariant: IntegrityInvariant.PERIOD_OVERLAP,
        message: 'error issue',
      },
    ];

    expect(maxDebugStatusFromIntegrityIssues(issues)).toBe('error');
  });

  it('returns ok when there are no integrity issues', () => {
    expect(maxDebugStatusFromIntegrityIssues([])).toBe('ok');
  });

  it('exposes canonical invariant constants', () => {
    expect(IntegrityInvariant.PERIOD_OVERLAP).toBe('PERIOD_OVERLAP');
    expect(IntegrityInvariant.DATE_HOLES).toBe('DATE_HOLES');
    expect(IntegrityInvariant.BASE_DATE_INCONSISTENT).toBe('BASE_DATE_INCONSISTENT');
    expect(IntegrityInvariant.TAF_DAYS_MISMATCH).toBe('TAF_DAYS_MISMATCH');
    expect(IntegrityInvariant.SVIE_SMERTE_MISMATCH).toBe('SVIE_SMERTE_MISMATCH');
  });
});

