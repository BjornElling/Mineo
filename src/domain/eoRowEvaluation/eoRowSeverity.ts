import type { EoRowStatus, IntegrityIssue, IntegritySeverity } from './eoRowTypes';

export const EO_ROW_STATUS_RANK: Readonly<Record<EoRowStatus, number>> = {
  ok: 0,
  warning: 1,
  error: 2,
};

export const toEoRowStatusRank = (status: EoRowStatus | undefined): number => {
  if (!status) return 0;
  return EO_ROW_STATUS_RANK[status] ?? 0;
};

export const maxEoRowStatusFromIntegrityIssues = (issues: readonly IntegrityIssue[]): EoRowStatus => {
  let maxSeverity: IntegritySeverity | undefined;

  for (const issue of issues) {
    const severity = issue.severity;
    if (!maxSeverity || toEoRowStatusRank(severity) > toEoRowStatusRank(maxSeverity)) {
      maxSeverity = severity;
    }
  }

  return maxSeverity ?? 'ok';
};

