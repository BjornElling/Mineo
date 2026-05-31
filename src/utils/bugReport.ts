/**
 * Bug Report utility til Mineo
 *
 * Funktioner:
 * - Genererer komplet fejlrapport med seneste 50 fejl fra IndexedDB
 * - Inkluderer version, dato, browser info
 * - Åbner mailto: med pre-filled email til bel@fho.dk
 * - Clipboard fallback hvis mailto: fejler
 * - Håndterer mailto: length limit (~1800 chars)
 */

import { getRecentLogEntries } from './logStorage';
import type { LogEntry } from './logStorage';
import { getTodayLocalISO } from './dateUtils';
import { formatISOToDanish, formatUtcTimestampSeconds } from './dateFormatting';
import { logError } from './logger';
import { isSystemIssueLogData } from './systemIssueReporter';
import { VERSION } from '../config/version';

export interface BugReportContext {
  source?: string;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  componentStack?: string;
}

export type BugReportExtraSection = {
  title: string;
  data: unknown;
};

export interface PreparedBugReport {
  report: string;
  email: {
    to: string;
    subject: string;
    body: string;
    mailtoLink: string;
    bodyWasTrimmed: boolean;
  };
  download: {
    filename: string;
  };
}

export type ContentBoxIdentity = {
  routePath: string;
  pageTitle?: string;
  sectionTitle?: string;
  boxIndex?: number;
  boxCount?: number;
  contentBoxId?: string;
};

const isPreparedBugReport = (value: unknown): value is PreparedBugReport => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.report === 'string' &&
    typeof record.email === 'object' &&
    record.email !== null &&
    typeof record.download === 'object' &&
    record.download !== null
  );
};

const getVersion = (): string => import.meta.env.VITE_APP_VERSION || VERSION;

const getCommitHash = (): string => {
  const candidates = [
    import.meta.env.VITE_APP_COMMIT_HASH,
    import.meta.env.VITE_GIT_COMMIT,
    import.meta.env.VITE_COMMIT_HASH,
    import.meta.env.VITE_BUILD_HASH,
  ];
  const resolved = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return resolved?.trim() ?? 'ukendt';
};

const parseBooleanFlag = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'ja' || normalized === 'yes' || normalized === 'on';
};

const getActiveTestInjectionsAndFeatureFlags = (): readonly string[] => {
  const flags: string[] = [];

  if (parseBooleanFlag(import.meta.env.VITE_FORCE_SAMMENTAELLING_MISMATCH)) {
    flags.push('VITE_FORCE_SAMMENTAELLING_MISMATCH');
  }

  if (parseBooleanFlag(import.meta.env.VITE_ENABLE_TEST_INJECTIONS)) {
    flags.push('VITE_ENABLE_TEST_INJECTIONS');
  }

  if (parseBooleanFlag(import.meta.env.VITE_ENABLE_DEBUG_TEST_FLAGS)) {
    flags.push('VITE_ENABLE_DEBUG_TEST_FLAGS');
  }

  if (typeof import.meta.env.VITE_ACTIVE_TEST_FLAGS === 'string') {
    const parsed = import.meta.env.VITE_ACTIVE_TEST_FLAGS
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');
    for (const value of parsed) {
      if (!flags.includes(value)) flags.push(value);
    }
  }

  return flags;
};

/**
 * Hent browser info
 *
 * @returns {string} Streng med browser info
 */
const getBrowserInfo = (): string => {
  const userAgent = navigator.userAgent;

  // Parse browser navn og version
  let browserName = 'Ukendt';
  let browserVersion = '';

  if (userAgent.indexOf('Chrome') > -1) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.indexOf('Firefox') > -1) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.indexOf('Safari') > -1) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.indexOf('Edge') > -1) {
    browserName = 'Edge';
    const match = userAgent.match(/Edge\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  }

  // Parse OS
  let os = 'Ukendt';
  if (userAgent.indexOf('Win') > -1) os = 'Windows';
  else if (userAgent.indexOf('Mac') > -1) os = 'macOS';
  else if (userAgent.indexOf('Linux') > -1) os = 'Linux';
  else if (userAgent.indexOf('Android') > -1) os = 'Android';
  else if (userAgent.indexOf('iOS') > -1) os = 'iOS';

  return `${browserName} ${browserVersion} (${os})`;
};

const ISO_UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const stringifyReportData = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, val: unknown) => {
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'symbol') return '[Symbol]';
    if (typeof val === 'function') return '[Function]';
    if (typeof val === 'string' && ISO_UTC_TIMESTAMP_RE.test(val)) {
      return formatUtcTimestampSeconds(new Date(val));
    }
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) return '[Circular]';
      seen.add(val as object);
    }
    return val;
  };

  try {
    const json = JSON.stringify(value, replacer, 2);
    return json ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * Formatér log entry til læsbar tekst
 *
 * @param {LogEntry} entry - Log entry at formatere
 * @returns {string} Formateret tekst
 */
const formatLogEntry = (entry: LogEntry): string => {
  const timestamp = formatUtcTimestampSeconds(new Date(entry.timestamp));
  const level = entry.level.toUpperCase();
  const context = entry.context || 'unknown';

  let formatted = `[${level}] ${timestamp} - ${context}\n`;
  formatted += `${entry.message}\n`;

  if (entry.stack) {
    // Trim stack trace til første 3 linjer (undgå for lang rapport)
    const stackLines = entry.stack.split('\n').slice(0, 3);
    formatted += `Stack: ${stackLines.join('\n')}\n`;
  }

  if (entry.data && Object.keys(entry.data).length > 0) {
    formatted += `Data: ${stringifyReportData(entry.data)}\n`;
  }

  return formatted;
};

const extractStructuredSystemIssues = (
  logEntries: readonly LogEntry[]
): readonly Record<string, unknown>[] => {
  return logEntries
    .flatMap((entry) => {
      // Log storage er append-only output. Vi laver kun en minimal strukturgaranti her
      // og gengiver payloaden som den blev logget, også hvis ældre entries mangler nyere felter.
      if (!isSystemIssueLogData(entry.data)) return [];
      return [{
        timestamp: entry.timestamp,
        level: entry.level,
        systemIssue: entry.data.systemIssue,
      }];
    });
};

/**
 * Generér komplet bug report
 *
 * @param {number} [maxEntries=50] - Max antal log entries at inkludere
 * @returns {Promise<string>} Formateret bug report
 */
export const generateBugReport = async (
  maxEntries = 50,
  context?: BugReportContext,
  extraSections?: BugReportExtraSection[]
): Promise<string> => {
  const version = getVersion();
  const commitHash = getCommitHash();
  const activeTestFlags = getActiveTestInjectionsAndFeatureFlags();
  const browserInfo = getBrowserInfo();
  const dato = formatUtcTimestampSeconds(new Date());

  // Hent seneste log entries fra IndexedDB
  const logEntries = await getRecentLogEntries(maxEntries);
  const systemIssues = extractStructuredSystemIssues(logEntries);

  // Byg rapport
  let report = '=== Mineo Fejlrapport ===\n';
  report += `Version: ${version}\n`;
  report += `Commit/hash: ${commitHash}\n`;
  report += `Dato: ${dato}\n`;
  report += `Browser: ${browserInfo}\n`;
  report += `Aktive test-injektioner/feature flags: ${activeTestFlags.length > 0 ? activeTestFlags.join(', ') : 'Ingen'}\n`;
  report += '\n';

  if (context) {
    const hasAnyContext =
      !!context.source ||
      !!context.errorName ||
      !!context.errorMessage ||
      !!context.errorStack ||
      !!context.componentStack;

    if (hasAnyContext) {
      report += '=== Kontekst ===\n';
      if (context.source) report += `Kilde: ${context.source}\n`;
      if (context.errorName) report += `Fejltype: ${context.errorName}\n`;
      if (context.errorMessage) report += `Fejlbesked: ${context.errorMessage}\n`;
      if (context.errorStack) report += `Stack:\n${context.errorStack}\n`;
      if (context.componentStack)
        report += `ComponentStack:\n${context.componentStack}\n`;
      report += '\n';
    }
  }

  if (extraSections && extraSections.length > 0) {
    report += '=== Ekstra oplysninger ===\n\n';

    extraSections.forEach((section) => {
      report += `--- ${section.title} ---\n`;
      report += `${stringifyReportData(section.data)}\n\n`;
    });
  }

  if (systemIssues.length > 0) {
    report += '=== Systemfejl payloads ===\n';
    report += `${stringifyReportData(systemIssues)}\n\n`;
  }

  if (logEntries.length === 0) {
    report += '=== Ingen fejl registreret ===\n';
    report += 'Der er ikke registreret nogle fejl i denne session.\n';
  } else {
    report += `=== Seneste fejl (${logEntries.length}) ===\n\n`;

    logEntries.forEach((entry, index) => {
      report += `--- Fejl ${index + 1} ---\n`;
      report += formatLogEntry(entry);
      report += '\n';
    });
  }

  return report;
};

const encodedLength = (value: string): number => {
  return encodeURIComponent(value).length;
};

const trimToEncodedLength = (value: string, maxEncodedLength: number): string => {
  if (encodedLength(value) <= maxEncodedLength) return value;
  if (maxEncodedLength <= 0) return '';

  let low = 0;
  let high = value.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = value.slice(0, mid);
    const candidateLength = encodedLength(candidate);
    if (candidateLength <= maxEncodedLength) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
};

const buildShortReport = (report: string): string => {
  const headerEnd = report.indexOf('=== Seneste fejl');
  const header = headerEnd === -1 ? report.trimEnd() : report.slice(0, headerEnd).trimEnd();
  return `${header}\n\n[Mailen er trimmet. Vedhæft downloadfilen for fuld rapport.]`;
};

const ensureEncodedBodyWithinLimit = (
  body: string,
  maxEncodedBodyLength: number
): { body: string; trimmed: boolean } => {
  if (encodedLength(body) <= maxEncodedBodyLength) {
    return { body, trimmed: false };
  }
  const trimmedBody = trimToEncodedLength(body, maxEncodedBodyLength);
  return {
    body: trimmedBody,
    trimmed: trimmedBody !== body,
  };
};

/**
 * Åbn mailto: link med pre-filled bug report
 *
 * @param {string} report - Bug report tekst
 * @returns {boolean} Succes-status
 */
const buildMailtoPayload = (report: string, options?: { subjectPrefix?: string }) => {
  try {
    const version = report.match(/Version: (.+)/)?.[1] || 'ukendt';
    const dato = formatISOToDanish(getTodayLocalISO());

    const subjectPrefix = options?.subjectPrefix ?? 'Mineo Fejlrapport';
    const subject = `${subjectPrefix} - v${version} - ${dato}`;

    const maxEncodedBodyLength = 1800;
    const shortReport = buildShortReport(report);
    let body = report;
    let bodyWasTrimmed = false;

    if (encodedLength(body) > maxEncodedBodyLength) {
      body = shortReport;
      bodyWasTrimmed = true;
    }

    if (encodedLength(body) > maxEncodedBodyLength) {
      const footer = '\n\n[Mailen er trimmet. Vedhæft downloadfilen for fuld rapport.]';
      const base = body.replace(footer, '').trimEnd();
      const maxBaseEncoded = maxEncodedBodyLength - encodedLength(footer);
      const trimmedBase = trimToEncodedLength(base, maxBaseEncoded);
      body = trimmedBase + footer;
      bodyWasTrimmed = true;
    }

    if (encodedLength(body) > maxEncodedBodyLength) {
      const fallback = '[Mailen er trimmet. Vedhæft downloadfilen for fuld rapport.]';
      const ensured = ensureEncodedBodyWithinLimit(fallback, maxEncodedBodyLength);
      body = ensured.body;
      bodyWasTrimmed = true;
    }

    if (encodedLength(body) > maxEncodedBodyLength) {
      const lastResort = '[Trimmet yderligere. Vedhæft downloadfilen for fuld rapport.]';
      const ensured = ensureEncodedBodyWithinLimit(lastResort, maxEncodedBodyLength);
      body = ensured.body;
      bodyWasTrimmed = true;
    }

    const mailtoLink = `mailto:bel@fho.dk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Åbn mailto: link
    // BEMÆRK: UI udløser email-navigation (mailto:) eksplicit.

    return {
      subject,
      body,
      mailtoLink,
      bodyWasTrimmed,
    };
  } catch (error) {
    logError('Kunne ikke åbne mailto', { context: 'buildMailtoPayload', error: error instanceof Error ? error : undefined });
    throw error;
  }
};

/**
 * Kopiér bug report til clipboard
 *
 * @param {string} report - Bug report tekst
 * @returns {Promise<boolean>} Succes-status
 */
export const copyBugReportToClipboard = async (report: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(report);
    return;
  } catch (error) {
    logError('Kunne ikke kopiere til clipboard', { context: 'copyBugReportToClipboard', error: error instanceof Error ? error : undefined });
    throw error;
  }
};

/**
 * Send bug report via email (åbner mailto: + kopierer til clipboard)
 *
 * @returns {Promise<{ emailOpened: boolean; clipboardCopied: boolean }>} Status
 */
export const prepareBugReport = async (options?: {
  maxEntries?: number;
  context?: BugReportContext;
  extraSections?: BugReportExtraSection[];
}): Promise<PreparedBugReport> => {
  // Generér rapport
  const report = await generateBugReport(
    options?.maxEntries ?? 50,
    options?.context,
    options?.extraSections
  );

  // Åbn mailto:
  const mailto = buildMailtoPayload(report);

  // Kopiér til clipboard (fallback)
  const version = getVersion();
  const dato = getTodayLocalISO();

  return {
    report,
    email: {
      to: 'bel@fho.dk',
      subject: mailto.subject,
      body: mailto.body,
      mailtoLink: mailto.mailtoLink,
      bodyWasTrimmed: mailto.bodyWasTrimmed,
    },
    download: {
      filename: `Mineo-fejlrapport-v${version}-${dato}.txt`,
    },
  };
};

/**
 * Forbered rapport for ContentBox (uden automatisk skærmprint).
 */
export const prepareContentBoxReport = async (options: {
  identity: ContentBoxIdentity;
  message?: string;
}): Promise<PreparedBugReport> => {
  const version = getVersion();
  const commitHash = getCommitHash();
  const activeTestFlags = getActiveTestInjectionsAndFeatureFlags();
  const browserInfo = getBrowserInfo();
  const dato = formatUtcTimestampSeconds(new Date());
  const message = (options.message ?? '').trim();

  let report = '=== Mineo Rapport ===\n';
  report += `Version: ${version}\n`;
  report += `Commit/hash: ${commitHash}\n`;
  report += `Dato: ${dato}\n`;
  report += `Browser: ${browserInfo}\n`;
  report += `Aktive test-injektioner/feature flags: ${activeTestFlags.length > 0 ? activeTestFlags.join(', ') : 'Ingen'}\n`;
  report += '\n';

  report += '=== Identifikation ===\n';
  report += `Sti: ${options.identity.routePath}\n`;
  if (options.identity.pageTitle) report += `Side: ${options.identity.pageTitle}\n`;
  if (options.identity.sectionTitle) report += `Sektion: ${options.identity.sectionTitle}\n`;
  if (options.identity.boxIndex != null && options.identity.boxCount != null) {
    report += `ContentBox: ${options.identity.boxIndex} af ${options.identity.boxCount}\n`;
  }
  if (options.identity.contentBoxId) report += `ContentBox ID: ${options.identity.contentBoxId}\n`;
  report += '\n';

  report += '=== Brugerbesked ===\n';
  report += message === '' ? '[Ingen besked]\n' : `${message}\n`;
  report += '\n';

  report += '=== Skærmprint ===\n';
  report += 'Skærmprint genereres lokalt via "Download skærmprint" i rapport-vinduet.\n';

  const mailto = buildMailtoPayload(report, { subjectPrefix: 'Mineo Rapport' });

  const datoIso = getTodayLocalISO();
  return {
    report,
    email: {
      to: 'bel@fho.dk',
      subject: mailto.subject,
      body: mailto.body,
      mailtoLink: mailto.mailtoLink,
      bodyWasTrimmed: mailto.bodyWasTrimmed,
    },
    download: {
      filename: `Mineo-rapport-v${version}-${datoIso}.txt`,
    },
  };
};

/**
 * Åbn mailto: link for bug report (side effect).
 */
export const openBugReportEmail = (prepared: PreparedBugReport): void => {
  window.location.href = prepared.email.mailtoLink;
};


export type DownloadBugReportOptions = {
  report?: string;
  filename?: string;
};

/**
 * Download bug report som .txt fil.
 */
export async function downloadBugReport(prepared: PreparedBugReport): Promise<void>;
export async function downloadBugReport(options?: DownloadBugReportOptions): Promise<void>;
export async function downloadBugReport(
  arg?: PreparedBugReport | DownloadBugReportOptions
): Promise<void> {
  const report = isPreparedBugReport(arg) ? arg.report : arg?.report ?? (await generateBugReport(50));
  const filename =
    (isPreparedBugReport(arg) ? arg.download.filename : arg?.filename) ??
    `Mineo-fejlrapport-v${getVersion()}-${getTodayLocalISO()}.txt`;

  // Opret blob og download
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
