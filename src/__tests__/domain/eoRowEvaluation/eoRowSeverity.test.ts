import { IntegrityInvariant, type IntegrityIssue } from '../../../domain/eoRowEvaluation/eoRowTypes';
import { maxEoRowStatusFromIntegrityIssues, toEoRowStatusRank } from '../../../domain/eoRowEvaluation/eoRowSeverity';

describe('eoRowSeverity', () => {
  it('returns rank in expected order', () => {
    expect(toEoRowStatusRank('ok')).toBe(0);
    expect(toEoRowStatusRank('warning')).toBe(1);
    expect(toEoRowStatusRank('error')).toBe(2);
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

    expect(maxEoRowStatusFromIntegrityIssues(issues)).toBe('error');
  });

  it('returns ok when there are no integrity issues', () => {
    expect(maxEoRowStatusFromIntegrityIssues([])).toBe('ok');
  });

  it('exposes canonical invariant constants', () => {
    expect(IntegrityInvariant.PERIOD_OVERLAP).toBe('PERIOD_OVERLAP');
    expect(IntegrityInvariant.DATE_HOLES).toBe('DATE_HOLES');
    expect(IntegrityInvariant.BASE_DATE_INCONSISTENT).toBe('BASE_DATE_INCONSISTENT');
    expect(IntegrityInvariant.TAF_DAYS_MISMATCH).toBe('TAF_DAYS_MISMATCH');
    expect(IntegrityInvariant.SVIE_SMERTE_MISMATCH).toBe('SVIE_SMERTE_MISMATCH');
  });
});
