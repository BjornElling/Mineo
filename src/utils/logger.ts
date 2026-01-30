/**
 * Centraliseret logger til MINEO
 *
 * Features:
 * - Struktureret logging med timestamp, level, context, stack trace
 * - Persistering til IndexedDB (kun errors og warnings)
 * - Altid aktiv (ikke kun development mode)
 * - Privacy-compliant: Logger IKKE persondata (CPR, navne, etc.)
 */

import { saveLogEntry } from './logStorage';
import type { LogEntry } from './logStorage';

const isDevelopment = process.env.NODE_ENV === 'development';

const EXTENSION_REGEX = /\.([a-zA-Z0-9]{1,8})$/;

const hashString = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
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
const getTimestamp = (): string => {
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
const sanitizeData = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  // Kopiér felter, men fjern potentielle persondata
  for (const key in obj) {
    const lowerKey = key.toLowerCase();

    // Skip felter med persondata
    if (
      lowerKey.includes('cpr') ||
      lowerKey.includes('navn') ||
      lowerKey.includes('adresse') ||
      lowerKey.includes('email') ||
      lowerKey.includes('telefon')
    ) {
      // Log kun at feltet eksisterer, ikke værdien
      sanitized[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = true;
      continue;
    }

    sanitized[key] = obj[key];
  }

  return sanitized;
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
 * Logger debug-besked (kun development mode, ikke persisteret)
 *
 * @param {string} message - Besked at logge
 * @param {Record<string, unknown>} [data] - Ekstra data
 */
export const logDebug = (message: string, data?: Record<string, unknown>): void => {
  if (isDevelopment) {
    console.debug(`[${getReadableTimestamp()}] [DEBUG]`, message, data || '');
  }
};

/**
 * Logger info-besked (kun development mode, ikke persisteret)
 *
 * @param {string} message - Besked at logge
 * @param {Record<string, unknown>} [data] - Ekstra data
 */
export const logInfo = (message: string, data?: Record<string, unknown>): void => {
  if (isDevelopment) {
    console.debug(`[${getReadableTimestamp()}]`, message, data || '');
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

/**
 * Logger start af operation (kun development mode, ikke persisteret)
 *
 * @param {string} operationName - Navn på operation
 */
export const logOperationStart = (operationName: string): void => {
  logDebug(`=== START: ${operationName} ===`);
};

/**
 * Logger afslutning af operation (kun development mode, ikke persisteret)
 *
 * @param {string} operationName - Navn på operation
 * @param {boolean} [success=true] - Om operation var succesfuld
 */
export const logOperationEnd = (operationName: string, success = true): void => {
  if (success) {
    logDebug(`=== SUCCESS: ${operationName} ===`);
  } else {
    logError(`=== FAILED: ${operationName} ===`, { context: operationName });
  }
};

/**
 * Logger data-statistik (kun development mode, ikke persisteret)
 *
 * @param {Record<string, unknown>} data - Data at logge statistik for
 * @param {string} [label='Data'] - Label til output
 */
export const logDataStats = (data: Record<string, unknown>, label = 'Data'): void => {
  if (!isDevelopment) return;

  const sections = Object.keys(data).filter((k) => !k.startsWith('_'));
  logDebug(`${label} indeholder ${sections.length} sektioner:`, { sections });

  sections.forEach((section) => {
    const sectionData = data[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      const fieldCount = Object.keys(sectionData as Record<string, unknown>).length;
      logDebug(`  - ${section}: ${fieldCount} felter`);
    }
  });
};
