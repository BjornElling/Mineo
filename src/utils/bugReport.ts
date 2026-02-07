/**
 * Bug Report utility til MINEO
 *
 * Funktioner:
 * - Genererer komplet fejlrapport med seneste 50 fejl fra IndexedDB
 * - Inkluderer version, dato, browser info
 * - Åbner mailto: med pre-filled email til bj.elling@gmail.com
 * - Clipboard fallback hvis mailto: fejler
 * - Håndterer mailto: length limit (~1800 chars)
 */

import { getRecentLogEntries } from './logStorage';
import type { LogEntry } from './logStorage';
import { getTodayLocalISO } from './dateUtils';

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

/**
 * Hent MINEO version fra package.json
 *
 * @returns {Promise<string>} Version string (fx "0.1.0")
 */
const getVersion = async (): Promise<string> => {
  try {
    // Vite loader package.json via import.meta.env
    // Fallback til "ukendt" hvis ikke tilgængelig
    return import.meta.env.VITE_APP_VERSION || '0.1.0';
  } catch {
    return '0.1.0';
  }
};

/**
 * Hent browser info
 *
 * @returns {string} Browser info string
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

const stringifyReportData = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, val: unknown) => {
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'symbol') return '[Symbol]';
    if (typeof val === 'function') return '[Function]';
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
  const timestamp = new Date(entry.timestamp).toLocaleString('da-DK');
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
  const version = await getVersion();
  const browserInfo = getBrowserInfo();
  const dato = new Date().toLocaleString('da-DK');

  // Hent seneste log entries fra IndexedDB
  const logEntries = await getRecentLogEntries(maxEntries);

  // Byg rapport
  let report = '=== MINEO Fejlrapport ===\n';
  report += `Version: ${version}\n`;
  report += `Dato: ${dato}\n`;
  report += `Browser: ${browserInfo}\n`;
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

/**
 * Trim rapport til max length (hvis mailto: limit overskrides)
 *
 * @param {string} report - Fuld rapport
 * @param {number} maxLength - Max længde i chars
 * @returns {string} Trimmet rapport
 */
const _trimReport = (report: string, maxLength: number): string => {
  if (report.length <= maxLength) {
    return report;
  }

  const footer = '\n\n[Rapport trimmet - kun seneste fejl inkluderet]';

  // Find header (alt før "=== Seneste fejl")
  const headerEnd = report.indexOf('=== Seneste fejl');
  if (headerEnd === -1) {
    // Ingen fejl sektion - bare trim
    return report.substring(0, maxLength) + '\n\n[Rapport trimmet]';
  }

  const header = report.substring(0, headerEnd);
  if (header.length >= maxLength) {
    const maxHeaderLength = Math.max(0, maxLength - footer.length);
    return header.slice(0, maxHeaderLength) + footer;
  }

  const availableSpace = maxLength - header.length - footer.length;

  // Tag så mange fejl som muligt
  const logSection = report.substring(headerEnd);
  const trimmedLogs = logSection.substring(0, Math.max(0, availableSpace));

  return header + trimmedLogs + footer;
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
 * @returns {boolean} Success status
 */
const buildMailtoPayload = (report: string, options?: { subjectPrefix?: string }) => {
  try {
    const version = report.match(/Version: (.+)/)?.[1] || 'ukendt';
    const dato = new Date().toLocaleDateString('da-DK');

    const subjectPrefix = options?.subjectPrefix ?? 'MINEO Fejlrapport';
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

    const mailtoLink = `mailto:bj.elling@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Åbn mailto: link
    // NOTE: UI triggers email navigation (mailto:) explicitly.

    return {
      subject,
      body,
      mailtoLink,
      bodyWasTrimmed,
    };
  } catch (error) {
    console.error('Kunne ikke åbne mailto:', error);
    throw error;
  }
};

/**
 * Kopiér bug report til clipboard
 *
 * @param {string} report - Bug report tekst
 * @returns {Promise<boolean>} Success status
 */
export const copyBugReportToClipboard = async (report: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(report);
    return;
  } catch (error) {
    console.error('Kunne ikke kopiere til clipboard:', error);
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
  const version = await getVersion();
  const dato = getTodayLocalISO();

  return {
    report,
    email: {
      to: 'bj.elling@gmail.com',
      subject: mailto.subject,
      body: mailto.body,
      mailtoLink: mailto.mailtoLink,
      bodyWasTrimmed: mailto.bodyWasTrimmed,
    },
    download: {
      filename: `MINEO-fejlrapport-v${version}-${dato}.txt`,
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
  const version = await getVersion();
  const browserInfo = getBrowserInfo();
  const dato = new Date().toLocaleString('da-DK');
  const message = (options.message ?? '').trim();

  let report = '=== MINEO Rapport ===\n';
  report += `Version: ${version}\n`;
  report += `Dato: ${dato}\n`;
  report += `Browser: ${browserInfo}\n`;
  report += '\n';

  report += '=== Identifikation ===\n';
  report += `Sti: ${options.identity.routePath}\n`;
  if (options.identity.pageTitle) report += `Side: ${options.identity.pageTitle}\n`;
  if (options.identity.sectionTitle) report += `Sektion: ${options.identity.sectionTitle}\n`;
  if (options.identity.boxIndex && options.identity.boxCount) {
    report += `ContentBox: ${options.identity.boxIndex} af ${options.identity.boxCount}\n`;
  }
  if (options.identity.contentBoxId) report += `ContentBox ID: ${options.identity.contentBoxId}\n`;
  report += '\n';

  report += '=== Brugerbesked ===\n';
  report += message === '' ? '[Ingen besked]\n' : `${message}\n`;
  report += '\n';

  report += '=== Skærmprint ===\n';
  report += 'Skærmprint genereres lokalt via "Download skærmprint" i rapport-vinduet.\n';

  const mailto = buildMailtoPayload(report, { subjectPrefix: 'MINEO Rapport' });

  const datoIso = getTodayLocalISO();
  return {
    report,
    email: {
      to: 'bj.elling@gmail.com',
      subject: mailto.subject,
      body: mailto.body,
      mailtoLink: mailto.mailtoLink,
      bodyWasTrimmed: mailto.bodyWasTrimmed,
    },
    download: {
      filename: `MINEO-rapport-v${version}-${datoIso}.txt`,
    },
  };
};

/**
 * Åbn mailto: link for bug report (side effect).
 */
export const openBugReportEmail = (prepared: PreparedBugReport): void => {
  window.location.href = prepared.email.mailtoLink;
};

/**
 * Kopiér bug report til clipboard.
 */
export const copyBugReport = async (prepared: PreparedBugReport): Promise<void> => {
  await copyBugReportToClipboard(prepared.report);
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
    `MINEO-fejlrapport-v${await getVersion()}-${getTodayLocalISO()}.txt`;

  // Opret blob og download
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
