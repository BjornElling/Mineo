/**
 * Centraliseret logger til Mineo
 *
 * Features:
 * - Struktureret logging med timestamp, level, context, stack trace
 * - Persistering til IndexedDB (kun errors og warnings)
 * - Altid aktiv (ikke kun development mode)
 * - Privacy-compliant: Logger IKKE persondata (CPR, navne, etc.)
 */

import { saveLogEntry } from './logStorage';
import type { LogEntry } from './logStorage';
import { fnv1a32 } from './fnv1a32';

const EXTENSION_REGEX = /\.([a-zA-Z0-9]{1,8})$/;

const hashString = (value: string): string => {
  return fnv1a32(value).toString(16).padStart(8, '0');
};

export const sanitizeFilenameForLog = (filename: unknown): string => {
  if (typeof filename !== 'string' || filename.trim() === '') {
    return 'ukendt fil (navn-hash ukendt)';
  }

  const match = filename.match(EXTENSION_REGEX);
  const extension = match?.[1]?.toLowerCase();
  const hash = hashString(filename);
  const prefix = extension ? `.${extension} fil` : 'fil';
  return `${prefix} (navn-hash ${hash})`;
};

/**
 * Formaterer timestamp til ISO string
 */
export const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Formaterer timestamp til læsbart format (konsol-output)
 */
const getReadableTimestamp = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

/**
 * Hjælpefunktion: Sanitér data (fjern potentielle persondata)
 *
 * @param {unknown} data - Data at sanitere
 * @returns {Record<string, unknown>} Saniteret data
 */
const PERSONDATA_KEY_MARKERS = ['cpr', 'navn', 'adresse', 'email', 'telefon'];

const isPersondataKey = (key: string): boolean => {
  const lowerKey = key.toLowerCase();
  return PERSONDATA_KEY_MARKERS.some((marker) => lowerKey.includes(marker));
};

const sanitizeValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isPersondataKey(key)) {
      sanitized[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = true;
      continue;
    }
    sanitized[key] = sanitizeValue(entry, seen);
  }
  return sanitized;
};

const sanitizeData = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  const sanitized = sanitizeValue(data, new WeakSet());
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
};

/**
 * Hjælpefunktion: Gem til IndexedDB (kun errors og warnings)
 *
 * @param {Omit<LogEntry, 'id'>} entry - Log entry at gemme
 */
const persistLog = (entry: Omit<LogEntry, 'id'>): void => {
  // Kun gem errors og warnings (ikke debug/info)
  if (entry.level === 'error' || entry.level === 'warn') {
    saveLogEntry(entry).catch((err) => {
      // Undgå infinite loop - log kun til konsol
      console.error('Kunne ikke gemme log entry til IndexedDB:', err);
    });
  }
};

/**
 * Logger warning-besked (altid aktiv, persisteret til IndexedDB)
 *
 * @param {string} message - Besked at logge
 * @param {object} options - Log options
 * @param {string} [options.context] - Kontekst (fx 'Aarsloen.periodeBeregning')
 * @param {Record<string, unknown>} [options.data] - Ekstra data (saniteres automatisk)
 */
export const logWarning = (
  message: string,
  options?: { context?: string; data?: Record<string, unknown> }
): void => {
  const timestamp = getTimestamp();
  const context = options?.context || 'unknown';
  const sanitizedData = options?.data ? sanitizeData(options.data) : undefined;

  // Log til konsol
  console.warn(
    `[${getReadableTimestamp()}] [WARNING] [${context}]`,
    message,
    sanitizedData || ''
  );

  // Gem til IndexedDB
  persistLog({
    timestamp,
    level: 'warn',
    context,
    message,
    data: sanitizedData,
  });
};

/**
 * Logger error-besked (altid aktiv, persisteret til IndexedDB)
 *
 * @param {string} message - Besked at logge
 * @param {object} options - Log options
 * @param {string} [options.context] - Kontekst (fx 'Aarsloen.periodeBeregning')
 * @param {Error} [options.error] - Error-objekt med stack trace
 * @param {string} [options.stack] - Stack trace som ren tekst (alternativ til Error-objekt)
 * @param {Record<string, unknown>} [options.data] - Ekstra data (saniteres automatisk)
 */
export const logError = (
  message: string,
  options?: { context?: string; error?: Error; stack?: string; data?: Record<string, unknown> }
): void => {
  const timestamp = getTimestamp();
  const context = options?.context || 'unknown';
  const sanitizedData = options?.data ? sanitizeData(options.data) : undefined;
  const stack = options?.stack ?? options?.error?.stack;

  // Log til konsol
  console.error(
    `[${getReadableTimestamp()}] [ERROR] [${context}]`,
    message,
    sanitizedData || '',
    stack || ''
  );

  // Gem til IndexedDB
  persistLog({
    timestamp,
    level: 'error',
    context,
    message,
    stack,
    data: sanitizedData,
  });
};
