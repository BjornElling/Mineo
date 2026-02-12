import type { DebugStatus, IntegrityIssue, IntegritySeverity } from './eoDebugTypes';

export const DEBUG_STATUS_RANK: Readonly<Record<DebugStatus, number>> = {
  ok: 0,
  warning: 1,
  error: 2,
};

export const toDebugStatusRank = (status: DebugStatus | undefined): number => {
  if (!status) return 0;
  return DEBUG_STATUS_RANK[status] ?? 0;
};

export const maxDebugStatusFromIntegrityIssues = (issues: readonly IntegrityIssue[]): DebugStatus => {
  let maxSeverity: IntegritySeverity | undefined;

  for (const issue of issues) {
    const severity = issue.severity;
    if (!maxSeverity || toDebugStatusRank(severity) > toDebugStatusRank(maxSeverity)) {
      maxSeverity = severity;
    }
  }

  return maxSeverity ?? 'ok';
};

