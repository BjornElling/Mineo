import { countFilledFields } from './dataCollection';
import { decryptFromString, EncryptionError } from './encryption';
import { selectFile, readFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  logOperationStart,
  logOperationEnd,
  logDataStats,
  logDebug,
  logWarning,
  logError,
  sanitizeFilenameForLog,
} from './logger';
import { FILE_FORMAT_VERSION, MAX_FILE_SIZE } from '../config/version';
import { STORAGE_KEYS, type StorageKey } from '../config/storageManifest';
import { nullToUndefinedDeep, persistenceSchemaFingerprint, persistenceSchemas } from '../config/persistenceRegistry';
import { buildPersistenceDefaults, type PersistedSectionDefaults } from '../config/persistenceDefaults';
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
} from './fileSystemAccess';
import type { LoadFileResult } from '../types/fileOperations';
import { eoFileContainerLoadSchema, type EoFileContainerLoad } from '../schemas/eoFileSchema';
import { CalculationError } from './errorMessages';
import { applyDefaultsDeep, stripUnknownFieldsBySchema, type UnknownPath } from './persistenceLoadSanitization';
import type { AppSettings } from '../settings/appSettingsSchema';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const formatZodIssues = (issues: Array<{ path: Array<string | number | symbol>; message: string }>, max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0
        ? issue.path
          .map((seg) => (typeof seg === 'symbol' ? (seg.description ?? 'symbol') : String(seg)))
          .join('.')
        : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};

const normalizeDecryptedContainer = (decrypted: unknown): EoFileContainerLoad => {
  if (!isRecord(decrypted)) {
    throw new Error('Ugyldig fil-struktur (ikke et objekt)');
  }

  const parsed = eoFileContainerLoadSchema.safeParse(decrypted);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error.issues, 3);
    const suffix = issues.trim() !== '' ? `\n\nDetaljer (første 3):\n${issues}` : '';
    throw new Error(
      `Filen matcher ikke denne versions data-schema og kan derfor ikke indlæses.\n` +
      `Den er sandsynligvis gemt i en ældre version, eller filen er korrupt.${suffix}`
    );
  }

  return parsed.data;
};

/**
 * Indlæser data fra krypteret .eo fil.
 *
 * VIGTIGT (trust-critical):
 * - Load validerer og returnerer et snapshot; selve anvendelsen sker atomisk via persistence-laget.
 *
 * @param resolvedDirectory - Optional resolved directory fra resolveDefaultDirectoryHandle
 */
type LoadIssue = { path: string; reason: string };
type ZodIssueLike = { path: Array<string | number | symbol> };

const formatPathSegments = (segments: Array<string | number>): string => {
  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += `[${seg + 1}]`;
    } else {
      out += out === '' ? seg : `.${seg}`;
    }
  }
  return out === '' ? '(root)' : out;
};

const toLoadIssuePath = (sectionKey: StorageKey, path: UnknownPath): string => {
  const detailPath = path.length > 0 ? formatPathSegments(path) : '(root)';
  return detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
};

const applyDefaultsForSection = (
  sectionKey: StorageKey,
  value: unknown,
  defaults: PersistedSectionDefaults
): unknown => {
  const sectionDefaults = defaults[sectionKey];
  return sectionDefaults ? applyDefaultsDeep(value, sectionDefaults) : value;
};

export const loadFromFile = async (
  resolvedDirectory?: ResolvedDirectory,
  options?: { settings?: AppSettings }
): Promise<LoadFileResult> => {
  logOperationStart('Hent fil');

  try {
    let file: File;
    let fileHandle: FileSystemFileHandle | null = null;
    let fileContent: string;

    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {
      logDebug('Bruger File System Access API');

      // Bestem startIn baseret på resolved directory
      const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';

      const result = await openFileWithPicker(startIn);
      if (!result) {
        logDebug('Bruger annullerede fil-valg');
        return { success: false, cancelled: true, source: 'manual' };
      }

      file = result.file;
      fileHandle = result.handle;

      logDebug(`Fil valgt: ${sanitizeFilenameForLog(file.name)}`);

      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
      }

      logDebug('Læser fil via File System Access API...');
      fileContent = await readFromFileHandle(fileHandle);
      logDebug(`✓ Fil læst (${fileContent.length} bytes)`);
    } else {
      logWarning('File System Access API ikke tilgængelig - bruger fallback file picker');

      const selected = await selectFile('.eo');
      if (!selected) {
        logDebug('Bruger annullerede fil-valg');
        return { success: false, cancelled: true, source: 'manual' };
      }

      file = selected;

      logDebug(`Fil valgt: ${sanitizeFilenameForLog(file.name)}`);

      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
      }

      logDebug('Læser fil...');
      fileContent = await readFile(file);
      logDebug(`✓ Fil læst (${fileContent.length} bytes)`);
    }

    logDebug('Dekrypterer data...');
    let decrypted: unknown;
    try {
      decrypted = await decryptFromString(fileContent);
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw new CalculationError('FILE_LOAD_FAILED', { cause: error });
      }
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      logError('Dekryptering fejlede', { context: 'loadFromFile.decrypt', error: error instanceof Error ? error : undefined });
      throw new Error(`Kunne ikke dekryptere fil: ${message}`);
    }
    logDebug('✓ Data dekrypteret (integritet OK)');

    const fileContainer = normalizeDecryptedContainer(decrypted);
    const fileData = fileContainer.data;
    const loadIssues: LoadIssue[] = [];
    const defaults = buildPersistenceDefaults(options?.settings);

    const fileVersion = fileContainer.version || 'ukendt';
    logDebug(`Fil version: ${fileVersion}`);
    if (fileVersion !== FILE_FORMAT_VERSION) {
      loadIssues.push({
        path: 'version',
        reason: `Filen er gemt i en anden version (${fileVersion}) og kan mangle felter i denne version`,
      });
    }

    const expectedFieldCount = fileContainer._metadata?.fieldCount;
    const fileSchemaHash = fileContainer._metadata?.schemaHash;
    logDebug(`Forventet antal felter: ${expectedFieldCount ?? 'ikke angivet'}`);

    logDataStats(fileData as unknown as Record<string, unknown>, 'Dekrypteret data');

    const fileFieldCount = countFilledFields(fileData as unknown as Record<string, unknown>);
    if (fileFieldCount === 0) {
      throw new Error('Filen indeholder ingen udfyldte felter');
    }

    const sectionsPresent = (Object.keys(STORAGE_KEYS) as StorageKey[]).filter(
      (k) => Object.prototype.hasOwnProperty.call(fileData, k) && (fileData as Record<string, unknown>)[k] !== undefined
    );

    const snapshot: Partial<Record<StorageKey, unknown>> = {};
    for (const sectionKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const raw = (fileData as Record<string, unknown>)[sectionKey];
      if (raw === undefined) continue;

      const schema = persistenceSchemas[sectionKey];
      const normalized = nullToUndefinedDeep(raw);
      const stripped = stripUnknownFieldsBySchema(schema, normalized);
      if (stripped.unknownPaths.length > 0) {
        stripped.unknownPaths.forEach((path) => {
          loadIssues.push({
            path: toLoadIssuePath(sectionKey, path),
            reason: 'Feltet findes ikke i denne version og blev ikke indlæst',
          });
        });
      }

      const withDefaults = applyDefaultsForSection(sectionKey, stripped.sanitized, defaults);
      const direct = schema.safeParse(withDefaults);
      if (direct.success) {
        snapshot[sectionKey] = direct.data;
        continue;
      }

      // DEBUG: Log Zod-fejl for at identificere hvad der fejler i prod
      logDebug(`[FILELOAD DEBUG loadFromFile] Section: ${sectionKey}`);
      logDebug(`[FILELOAD DEBUG] Zod issues (${direct.error.issues.length} total):`);
      direct.error.issues.slice(0, 5).forEach((issue, idx) => {
        logDebug(`[FILELOAD DEBUG] Issue ${idx + 1}:`, { issue });
      });
      if (direct.error.issues.length > 5) {
        logDebug(`[FILELOAD DEBUG] ... og ${direct.error.issues.length - 5} flere issues`);
      }
      if (sectionKey === 'erstatningsopgoerelse' && typeof normalized === 'object' && normalized !== null) {
        const norm = normalized as Record<string, unknown>;
        if (Array.isArray(norm['loenindkomstAnsaettelsesforhold'])) {
          const arr = norm['loenindkomstAnsaettelsesforhold'] as unknown[];
          arr.forEach((item, i) => {
            if (typeof item === 'object' && item !== null) {
              logDebug(`[FILELOAD DEBUG] loenindkomstAnsaettelsesforhold[${i}] keys:`, {
                keys: Object.keys(item),
              });
            }
          });
        }
      }

      const primaryIssue = direct.error.issues[0] as unknown as ZodIssueLike | undefined;
      const normalizedPath = primaryIssue
        ? primaryIssue.path.filter((seg): seg is string | number => typeof seg === 'string' || typeof seg === 'number')
        : [];
      const detailPath = normalizedPath.length > 0 ? formatPathSegments(normalizedPath) : '(root)';
      const issuePath = detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
      const reasonDetail = 'Forkert format';
      loadIssues.push({
        path: issuePath,
        reason: `Sektionen kunne ikke indlæses (${reasonDetail}) og blev ikke indlæst`,
      });
    }

    // Ukendte sektioner i filen (fra andre versioner) kan ikke indlæses.
    for (const key of Object.keys(fileData as Record<string, unknown>)) {
      if (key.startsWith('_')) continue;
      const isKnown = Object.prototype.hasOwnProperty.call(persistenceSchemas, key);
      if (!isKnown) {
        loadIssues.push({
          path: key,
          reason: 'Sektionen findes ikke i denne version og blev ikke indlæst',
        });
      }
    }

    const loadedFieldCount = countFilledFields(snapshot as unknown as Record<string, unknown>);
    if (loadedFieldCount === 0) {
      throw new Error('Filen indeholder ingen data der kan indlæses i denne version');
    }

    const expectedCountForUser = expectedFieldCount ?? fileFieldCount;
    const failedCountForUser = expectedCountForUser >= loadedFieldCount
      ? expectedCountForUser - loadedFieldCount
      : 0;

    const fieldCountWarning = expectedFieldCount !== undefined && expectedFieldCount !== loadedFieldCount
      ? {
        message: `Forventet ${expectedFieldCount} felter, fandt ${loadedFieldCount} (diff: ${loadedFieldCount - expectedFieldCount})`,
        expected: expectedFieldCount,
        actual: loadedFieldCount,
        difference: loadedFieldCount - expectedFieldCount,
      }
      : undefined;

    // Debug-info (kan inspiceres efter successful apply)
    const debugInfo = {
      expectedFieldCount,
      actualFieldCount: loadedFieldCount,
      sectionsInFile: sectionsPresent,
      schemaHashInFile: fileSchemaHash ?? null,
      schemaHashCurrent: persistenceSchemaFingerprint,
      timestamp: new Date().toISOString(),
    };

    logOperationEnd('Hent fil', true);

    const shouldPreflightWarn = loadIssues.length > 0;

    return {
      success: true,
      source: 'manual',
      filename: file.name,
      fileHandle: fileHandle ?? undefined,
      fieldCount: loadedFieldCount,
      expectedFieldCount,
      sections: sectionsPresent.length,
      version: fileVersion,
      snapshot,
      debugInfo,
      fieldCountWarning,
      preflightWarning: shouldPreflightWarn
        ? {
          expectedCount: expectedFieldCount ?? fileFieldCount,
          loadedCount: loadedFieldCount,
          failedCount: failedCountForUser,
          issues: loadIssues,
        }
        : undefined,
    };
  } catch (error) {
    if (error instanceof CalculationError && error.code === 'FILE_LOAD_FAILED') {
      logOperationEnd('Hent fil', true);
      throw error;
    }

    logOperationEnd('Hent fil', false);

    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
    logError('Hent-operation fejlede', { context: 'loadFromFile', error: error instanceof Error ? error : undefined });

    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};

export const loadFromFileHandle = async (
  fileHandle: FileSystemFileHandle,
  options?: { requestId?: string; settings?: AppSettings }
): Promise<LoadFileResult> => {
  logOperationStart('Hent fil');

  try {
    const file = await fileHandle.getFile();

    logDebug(`Fil valgt: ${sanitizeFilenameForLog(file.name)}`);

    if (!file.name.toLowerCase().endsWith('.eo')) {
      throw new Error('Valgt fil er ikke en .eo fil');
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
    }

    logDebug('Læser fil via File System Access API...');
    const fileContent = await readFromFileHandle(fileHandle);
    logDebug(`✓ Fil læst (${fileContent.length} bytes)`);

    logDebug('Dekrypterer data...');
    let decrypted: unknown;
    try {
      decrypted = await decryptFromString(fileContent);
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw new CalculationError('FILE_LOAD_FAILED', { cause: error });
      }
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      logError('Dekryptering fejlede', { context: 'loadFromFileHandle.decrypt', error: error instanceof Error ? error : undefined });
      throw new Error(`Kunne ikke dekryptere fil: ${message}`);
    }
    logDebug('✓ Data dekrypteret (integritet OK)');

    const fileContainer = normalizeDecryptedContainer(decrypted);
    const fileData = fileContainer.data;
    const loadIssues: LoadIssue[] = [];
    const defaults = buildPersistenceDefaults(options?.settings);

    const fileVersion = fileContainer.version || 'ukendt';
    logDebug(`Fil version: ${fileVersion}`);
    if (fileVersion !== FILE_FORMAT_VERSION) {
      loadIssues.push({
        path: 'version',
        reason: `Filen er gemt i en anden version (${fileVersion}) og kan mangle felter i denne version`,
      });
    }

    const expectedFieldCount = fileContainer._metadata?.fieldCount;
    const fileSchemaHash = fileContainer._metadata?.schemaHash;
    logDebug(`Forventet antal felter: ${expectedFieldCount ?? 'ikke angivet'}`);

    logDataStats(fileData as unknown as Record<string, unknown>, 'Dekrypteret data');

    const fileFieldCount = countFilledFields(fileData as unknown as Record<string, unknown>);
    if (fileFieldCount === 0) {
      throw new Error('Filen indeholder ingen udfyldte felter');
    }

    const sectionsPresent = (Object.keys(STORAGE_KEYS) as StorageKey[]).filter(
      (k) => Object.prototype.hasOwnProperty.call(fileData, k) && (fileData as Record<string, unknown>)[k] !== undefined
    );

    const snapshot: Partial<Record<StorageKey, unknown>> = {};
    for (const sectionKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const raw = (fileData as Record<string, unknown>)[sectionKey];
      if (raw === undefined) continue;

      const schema = persistenceSchemas[sectionKey];
      const normalized = nullToUndefinedDeep(raw);
      const stripped = stripUnknownFieldsBySchema(schema, normalized);
      if (stripped.unknownPaths.length > 0) {
        stripped.unknownPaths.forEach((path) => {
          loadIssues.push({
            path: toLoadIssuePath(sectionKey, path),
            reason: 'Feltet findes ikke i denne version og blev ikke indlæst',
          });
        });
      }

      const withDefaults = applyDefaultsForSection(sectionKey, stripped.sanitized, defaults);
      const direct = schema.safeParse(withDefaults);
      if (direct.success) {
        snapshot[sectionKey] = direct.data;
        continue;
      }

      // DEBUG: Log Zod-fejl for at identificere hvad der fejler i prod
      logDebug(`[FILELOAD DEBUG loadFromFileHandle] Section: ${sectionKey}`);
      logDebug(`[FILELOAD DEBUG] Zod issues (${direct.error.issues.length} total):`);
      direct.error.issues.slice(0, 5).forEach((issue, idx) => {
        logDebug(`[FILELOAD DEBUG] Issue ${idx + 1}:`, { issue });
      });
      if (direct.error.issues.length > 5) {
        logDebug(`[FILELOAD DEBUG] ... og ${direct.error.issues.length - 5} flere issues`);
      }
      if (sectionKey === 'erstatningsopgoerelse' && typeof normalized === 'object' && normalized !== null) {
        const norm = normalized as Record<string, unknown>;
        if (Array.isArray(norm['loenindkomstAnsaettelsesforhold'])) {
          const arr = norm['loenindkomstAnsaettelsesforhold'] as unknown[];
          arr.forEach((item, i) => {
            if (typeof item === 'object' && item !== null) {
              logDebug(`[FILELOAD DEBUG] loenindkomstAnsaettelsesforhold[${i}] keys:`, {
                keys: Object.keys(item),
              });
            }
          });
        }
      }

      const primaryIssue = direct.error.issues[0] as unknown as ZodIssueLike | undefined;
      const normalizedPath = primaryIssue
        ? primaryIssue.path.filter((seg): seg is string | number => typeof seg === 'string' || typeof seg === 'number')
        : [];
      const detailPath = normalizedPath.length > 0 ? formatPathSegments(normalizedPath) : '(root)';
      const issuePath = detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
      const reasonDetail = 'Forkert format';
      loadIssues.push({
        path: issuePath,
        reason: `Sektionen kunne ikke indlæses (${reasonDetail}) og blev ikke indlæst`,
      });
    }

    // Ukendte sektioner i filen (fra andre versioner) kan ikke indlæses.
    for (const key of Object.keys(fileData as Record<string, unknown>)) {
      if (key.startsWith('_')) continue;
      const isKnown = Object.prototype.hasOwnProperty.call(persistenceSchemas, key);
      if (!isKnown) {
        loadIssues.push({
          path: key,
          reason: 'Sektionen findes ikke i denne version og blev ikke indlæst',
        });
      }
    }

    const loadedFieldCount = countFilledFields(snapshot as unknown as Record<string, unknown>);
    if (loadedFieldCount === 0) {
      throw new Error('Filen indeholder ingen data der kan indlæses i denne version');
    }

    const expectedCountForUser = expectedFieldCount ?? fileFieldCount;
    const failedCountForUser = expectedCountForUser >= loadedFieldCount
      ? expectedCountForUser - loadedFieldCount
      : 0;

    const fieldCountWarning = expectedFieldCount !== undefined && expectedFieldCount !== loadedFieldCount
      ? {
        message: `Forventet ${expectedFieldCount} felter, fandt ${loadedFieldCount} (diff: ${loadedFieldCount - expectedFieldCount})`,
        expected: expectedFieldCount,
        actual: loadedFieldCount,
        difference: loadedFieldCount - expectedFieldCount,
      }
      : undefined;

    // Debug-info (kan inspiceres efter successful apply)
    const debugInfo = {
      expectedFieldCount,
      actualFieldCount: loadedFieldCount,
      sectionsInFile: sectionsPresent,
      schemaHashInFile: fileSchemaHash ?? null,
      schemaHashCurrent: persistenceSchemaFingerprint,
      timestamp: new Date().toISOString(),
    };

    logOperationEnd('Hent fil', true);

    const shouldPreflightWarn = loadIssues.length > 0;

    return {
      success: true,
      source: 'pwa',
      requestId: options?.requestId,
      filename: file.name,
      fileHandle,
      fieldCount: loadedFieldCount,
      expectedFieldCount,
      sections: sectionsPresent.length,
      version: fileVersion,
      snapshot,
      debugInfo,
      fieldCountWarning,
      preflightWarning: shouldPreflightWarn
        ? {
          expectedCount: expectedFieldCount ?? fileFieldCount,
          loadedCount: loadedFieldCount,
          failedCount: failedCountForUser,
          issues: loadIssues,
        }
        : undefined,
    };
  } catch (error) {
    if (error instanceof CalculationError && error.code === 'FILE_LOAD_FAILED') {
      logOperationEnd('Hent fil', true);
      throw error;
    }

    logOperationEnd('Hent fil', false);

    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
    logError('Hent-operation fejlede', { context: 'loadFromFileHandle', error: error instanceof Error ? error : undefined });

    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};

/**
 * Validerer om en fil er en gyldig .eo fil uden at indlæse den.
 *
 * NOTE: Dette tjekker kun den ydre krypterede container (JSON), ikke indholdet efter dekryptering.
 */
export const validateEoFile = async (file: File): Promise<boolean> => {
  try {
    if (!file.name.toLowerCase().endsWith('.eo')) {
      return false;
    }

    const content = await readFile(file);
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) {
      return false;
    }

    return (
      parsed.version === 1 &&
      parsed.alg === 'A256GCM' &&
      typeof parsed.ivB64 === 'string' &&
      typeof parsed.ctB64 === 'string'
    );
  } catch (error) {
    logError('Fil-validering fejlede', { context: 'validateEoFile', error: error instanceof Error ? error : undefined });
    return false;
  }
};
