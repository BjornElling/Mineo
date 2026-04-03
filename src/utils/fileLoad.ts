import { countFilledFields } from './dataCollection';
import { decryptFromString, EncryptionError } from './encryption';
import { selectFile, readFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  logWarning,
  logError,
} from './logger';
import { FILE_FORMAT_VERSION, MAX_FILE_SIZE } from '../config/version';
import { STORAGE_KEYS, type StorageKey } from '../config/storageManifest';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
} from './fileSystemAccess';
import type { LoadFileResult } from '../types/fileOperations';
import { eoFileContainerLoadSchema, type EoFileContainerLoad } from '../schemas/eoFileSchema';
import { CalculationError } from './errorMessages';
import { stripUnknownFieldsBySchema, type UnknownPath } from './persistenceLoadSanitization';

import { isRecord } from './typeGuards';

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

  const rawVersion = decrypted.version;
  if (typeof rawVersion === 'string' && rawVersion !== FILE_FORMAT_VERSION) {
    throw new Error(`Ugyldig filversion. Forventet format ${FILE_FORMAT_VERSION}.`);
  }

  const parsed = eoFileContainerLoadSchema.safeParse(decrypted);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error.issues, 3);
    const suffix = issues.trim() !== '' ? `\n\nDetaljer (første 3):\n${issues}` : '';
    throw new Error(
      'Filen har ugyldig .eo-struktur og kan derfor ikke indlæses.\n' +
      `Filen er sandsynligvis korrupt eller ikke opbygget som en gyldig Mineo-fil.${suffix}`
    );
  }

  return parsed.data;
};

const formatPathSegments = (segments: Array<string | number>): string => {
  let out = '';
  for (const segment of segments) {
    if (typeof segment === 'number') {
      out += `[${segment + 1}]`;
    } else {
      out += out === '' ? segment : `.${segment}`;
    }
  }
  return out === '' ? '(root)' : out;
};

const toLoadIssuePath = (sectionKey: StorageKey, path: UnknownPath): string => {
  const detailPath = path.length > 0 ? formatPathSegments(path) : '(root)';
  return detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
};

const migrateLegacyFaellesPersondataIntoStamdata = (
  rawData: Record<string, unknown>
): Record<string, unknown> => {
  const nextData = { ...rawData };
  const rawLegacySection = nextData.faellesPersondata;
  if (!isRecord(rawLegacySection)) {
    return nextData;
  }

  const legacyFodselsdato = typeof rawLegacySection.skadelidteFodselsdato === 'string'
    ? rawLegacySection.skadelidteFodselsdato
    : undefined;
  if (!legacyFodselsdato) {
    return nextData;
  }

  const rawStamdata = isRecord(nextData.stamdata) ? nextData.stamdata : {};
  if (typeof rawStamdata.skadelidteFodselsdato !== 'string' || rawStamdata.skadelidteFodselsdato.trim() === '') {
    nextData.stamdata = {
      ...rawStamdata,
      skadelidteFodselsdato: legacyFodselsdato,
    };
  }

  return nextData;
};

/**
 * Indlæser data fra krypteret .eo fil.
 *
 * VIGTIGT (trust-critical):
 * - Load validerer og returnerer et snapshot; selve anvendelsen sker atomisk via persistence-laget.
 *
 * @param resolvedDirectory - Optional resolved directory fra resolveDefaultDirectoryHandle
 */
const processDecryptedContainer = (args: {
  fileContainer: EoFileContainerLoad;
  filename: string;
  source: 'manual' | 'pwa';
  fileHandle?: FileSystemFileHandle;
  requestId?: string;
}): LoadFileResult => {
  const { fileContainer, filename, source, fileHandle, requestId } = args;
  const fileData = migrateLegacyFaellesPersondataIntoStamdata(fileContainer.data as Record<string, unknown>);
  const { fieldCount: expectedFieldCount } = fileContainer._metadata;
  const loadIssues: Array<{ path: string; reason: string }> = [];

  const fileVersion = fileContainer.version;

  const fileFieldCount = countFilledFields(fileData as unknown as Record<string, unknown>);
  if (fileFieldCount === 0) {
    throw new Error('Filen indeholder ingen udfyldte felter');
  }

  const sectionsPresent = (Object.keys(STORAGE_KEYS) as StorageKey[]).filter(
    (k) => Object.prototype.hasOwnProperty.call(fileData, k) && (fileData as Record<string, unknown>)[k] !== undefined
  );

  const snapshot: Partial<Record<StorageKey, unknown>> = {};
  for (const sectionKey of Object.keys(persistenceSchemas) as StorageKey[]) {
    const rawValue = (fileData as Record<string, unknown>)[sectionKey];
    if (rawValue === undefined) {
      continue;
    }

    const schema = persistenceSchemas[sectionKey];
    const normalizedValue = nullToUndefinedDeep(rawValue);
    const stripped = stripUnknownFieldsBySchema(schema, normalizedValue);

    for (const path of stripped.unknownPaths) {
      loadIssues.push({
        path: toLoadIssuePath(sectionKey, path),
        reason: 'Feltet findes ikke i denne version og blev ikke indlæst',
      });
    }

    const parsedSection = schema.safeParse(stripped.sanitized);
    if (parsedSection.success) {
      snapshot[sectionKey] = parsedSection.data;
      continue;
    }

    const firstIssue = parsedSection.error.issues[0];
    const issuePathSegments = (firstIssue?.path ?? [])
      .filter((segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number');
    const detailPath = formatPathSegments(issuePathSegments);
    const issuePath = detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
    loadIssues.push({
      path: issuePath,
      reason: `Sektionen kunne ikke indlæses (${firstIssue?.message ?? 'Forkert format'}) og blev ikke indlæst`,
    });
  }

  for (const key of Object.keys(fileData as Record<string, unknown>)) {
    if (key.startsWith('_')) continue;
    if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, key)) {
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

  return {
    success: true,
    source,
    requestId,
    filename,
    fileHandle,
    fieldCount: loadedFieldCount,
    expectedFieldCount,
    sections: sectionsPresent.length,
    version: fileVersion,
    snapshot,
    preflightWarning: loadIssues.length > 0
      ? {
        expectedCount: expectedFieldCount,
        loadedCount: loadedFieldCount,
        failedCount: loadIssues.length,
        issues: loadIssues,
      }
      : undefined,
  };
};

export const loadFromFile = async (
  resolvedDirectory?: ResolvedDirectory
): Promise<LoadFileResult> => {

  try {
    let file: File;
    let fileHandle: FileSystemFileHandle | null = null;
    let fileContent: string;

    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {

      // Bestem startIn baseret på resolved directory
      const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';

      const result = await openFileWithPicker(startIn);
      if (!result) {
        return { success: false, cancelled: true, source: 'manual' };
      }

      file = result.file;
      fileHandle = result.handle;

      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
      }
      fileContent = await readFromFileHandle(fileHandle);
    } else {
      logWarning('File System Access API ikke tilgængelig - bruger fallback file picker');

      const selected = await selectFile('.eo');
      if (!selected) {
        return { success: false, cancelled: true, source: 'manual' };
      }

      file = selected;

      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
      }
      fileContent = await readFile(file);
    }
    let decrypted: unknown;
    try {
      decrypted = await decryptFromString(fileContent);
    } catch (error: unknown) {
      if (error instanceof EncryptionError) {
        throw new CalculationError('FILE_LOAD_FAILED', { cause: error });
      }
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      logError('Dekryptering fejlede', { context: 'loadFromFile.decrypt', error: error instanceof Error ? error : undefined });
      throw new Error(`Kunne ikke dekryptere fil: ${message}`, { cause: error });
    }

    const fileContainer = normalizeDecryptedContainer(decrypted);
    const result = processDecryptedContainer({
      fileContainer,
      filename: file.name,
      source: 'manual',
      fileHandle: fileHandle ?? undefined,
    });
    return result;
  } catch (error: unknown) {
    if (error instanceof CalculationError && error.code === 'FILE_LOAD_FAILED') {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
    logError('Hent-operation fejlede', { context: 'loadFromFile', error: error instanceof Error ? error : undefined });

    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};

export const loadFromFileHandle = async (
  fileHandle: FileSystemFileHandle,
  options?: { requestId?: string }
): Promise<LoadFileResult> => {

  try {
    const file = await fileHandle.getFile();

    if (!file.name.toLowerCase().endsWith('.eo')) {
      throw new Error('Valgt fil er ikke en .eo fil');
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
    }
    const fileContent = await readFromFileHandle(fileHandle);
    let decrypted: unknown;
    try {
      decrypted = await decryptFromString(fileContent);
    } catch (error: unknown) {
      if (error instanceof EncryptionError) {
        throw new CalculationError('FILE_LOAD_FAILED', { cause: error });
      }
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      logError('Dekryptering fejlede', { context: 'loadFromFileHandle.decrypt', error: error instanceof Error ? error : undefined });
      throw new Error(`Kunne ikke dekryptere fil: ${message}`, { cause: error });
    }

    const fileContainer = normalizeDecryptedContainer(decrypted);
    const result = processDecryptedContainer({
      fileContainer,
      filename: file.name,
      source: 'pwa',
      requestId: options?.requestId,
      fileHandle,
    });
    return result;
  } catch (error: unknown) {
    if (error instanceof CalculationError && error.code === 'FILE_LOAD_FAILED') {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
    logError('Hent-operation fejlede', { context: 'loadFromFileHandle', error: error instanceof Error ? error : undefined });

    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};
