import { getTimestamp, logError, logWarning } from './logger';

export type SystemIssueSeverity = 'error' | 'warning';

export type SystemIssueArea =
  | 'eo'
  | 'debug'
  | 'react'
  | 'calculation'
  | 'pdf'
  | 'persistence'
  | 'file'
  | 'runtime'
  | 'devtools';

export type SystemIssueEnvelope = Readonly<{
  schemaVersion: 1;
  kind: 'system_issue';
  code: string;
  area: SystemIssueArea;
  severity: SystemIssueSeverity;
  context: string;
  route: string | null;
  timestamp: string;
  userMessage: string;
  developerMessage?: string;
  revision?: string;
  evidence?: readonly string[];
  diagnostics?: Record<string, unknown>;
}>;

export type SystemIssueLogData = Readonly<{
  systemIssue: SystemIssueEnvelope;
}>;

export type ReportSystemIssueInput = Readonly<{
  code: string;
  area: SystemIssueArea;
  severity?: SystemIssueSeverity;
  context: string;
  userMessage: string;
  developerMessage?: string;
  revision?: string;
  evidence?: readonly string[];
  diagnostics?: Record<string, unknown>;
  error?: Error;
  stack?: string;
}>;

const getRoute = (): string | null => {
  if (typeof window === 'undefined' || !window.location) return null;
  return window.location.pathname;
};

export const createSystemIssueEnvelope = (
  input: ReportSystemIssueInput
): SystemIssueEnvelope => {
  return {
    schemaVersion: 1,
    kind: 'system_issue',
    code: input.code,
    area: input.area,
    severity: input.severity ?? 'error',
    context: input.context,
    route: getRoute(),
    timestamp: getTimestamp(),
    userMessage: input.userMessage,
    developerMessage: input.developerMessage,
    revision: input.revision,
    evidence: input.evidence,
    diagnostics: input.diagnostics,
  };
};

export const isSystemIssueLogData = (value: unknown): value is SystemIssueLogData => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!candidate.systemIssue || typeof candidate.systemIssue !== 'object') return false;
  const issue = candidate.systemIssue as Record<string, unknown>;
  return issue.schemaVersion === 1
    && issue.kind === 'system_issue'
    && typeof issue.code === 'string'
    && typeof issue.userMessage === 'string';
};

export const reportSystemIssue = (input: ReportSystemIssueInput): void => {
  const envelope = createSystemIssueEnvelope(input);
  const data: SystemIssueLogData = {
    systemIssue: envelope,
  };
  const message = `Systemfejl registreret: ${input.userMessage}`;
  // `options.context` duplikerer envelope.context med vilje:
  // logStorage indekserer/top-level-præsenterer entries på `context`, mens den
  // strukturerede systemIssue-payload bevarer samme værdi som del af envelope-kontrakten.

  if (envelope.severity === 'warning') {
    logWarning(message, {
      context: input.context,
      data,
    });
    return;
  }

  logError(message, {
    context: input.context,
    error: input.error,
    stack: input.stack,
    data,
  });
};
