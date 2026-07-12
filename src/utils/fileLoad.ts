import { countFilledFields, countMeaningfulFields } from './dataCollection';
import { selectFile, readFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  logWarning,
  logError,
} from './logger';
import { MAX_FILE_SIZE } from '../config/version';
import { LEGACY_PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { STORAGE_KEYS, type StorageKey } from '../config/storageManifest';
import { persistenceSchemas } from '../config/persistenceRegistry';
import {
  ensureFileHandleReadPermission,
  FileHandleAccessError,
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
} from './fileSystemAccess';
import type { LoadFileResult, LoadIssue } from '../types/fileOperations';
import { type EoFileContainerLoad } from '../schemas/eoFileSchema';
import { decodeEoFile } from './eoFileCodec';
import { CalculationError } from './errorMessages';
import { type UnknownPath } from './persistenceLoadSanitization';
import { formatAsAmount } from './formatUtils';
import { parseInboundPersistedSection } from './inboundPersistedSection';

import { isRecord } from './typeGuards';

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

/** Slår den rå værdi op ved en strippet sti, så vi kan tælle hvor mange udfyldte felter der gik tabt. */
const getValueAtPath = (root: unknown, path: UnknownPath): unknown => {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
    } else {
      if (!isRecord(current)) return undefined;
      current = current[segment];
    }
  }
  return current;
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
  const fileData = fileContainer.data as Record<string, unknown>;
  const { fieldCount: expectedFieldCount } = fileContainer._metadata;
  const sourcePersistedDataVersion =
    fileContainer._metadata.persistedDataVersion ?? LEGACY_PERSISTED_DATA_VERSION;

  const fileVersion = fileContainer.version;

  const fileFieldCount = countFilledFields(fileData as unknown as Record<string, unknown>);
  if (fileFieldCount === 0) {
    throw new Error('Filen indeholder ingen udfyldte felter');
  }

  const sectionsPresent = (Object.keys(STORAGE_KEYS) as StorageKey[]).filter(
    (k) => Object.prototype.hasOwnProperty.call(fileData, k) && (fileData as Record<string, unknown>)[k] !== undefined
  );

  // Felter/sektioner, hvor gemt brugerdata IKKE kunne indlæses og derfor er sat til standardværdier.
  // Disse rapporteres til brugeren via preflight — stille datatab er uacceptabelt (AGENTS.md save/load,
  // persistence-contract §6.3 "Rapportér tab eller strip via preflight").
  const dataLossIssues: LoadIssue[] = [];
  // Antal udfyldte felter fra filen der gik tabt (strippet, droppet sektion eller ukendt sektion).
  // Migreringer bevarer data og tæller derfor IKKE som tab.
  let lostFromFileCount = 0;

  const snapshot: Partial<Record<StorageKey, unknown>> = {};
  for (const sectionKey of Object.keys(persistenceSchemas) as StorageKey[]) {
    const rawValue = (fileData as Record<string, unknown>)[sectionKey];
    if (rawValue === undefined) {
      continue;
    }

    // Den trust-kritiske inbound-kæde (migrator → sanitize → schema-parse) deles med session-hydrering
    // via parseInboundPersistedSection, så samme rå sektionsdata aldrig kan transformeres forskelligt
    // afhængigt af kilden. En migrator flytter/omsætter kendte gamle felter til current struktur — det er
    // en vellykket indlæsning (data bevares), ikke et tab, og tælles/vises derfor ikke i preflight.
    const parsedSection = parseInboundPersistedSection(
      sectionKey,
      rawValue,
      sourcePersistedDataVersion
    );
    if (parsedSection.ok) {
      snapshot[sectionKey] = parsedSection.data;
      // Strippede felter er gemt brugerdata, som denne version ikke længere kender. Værdien kan ikke
      // indlæses og feltet får sin standardværdi → rapportér det til brugeren (ikke et stille tab).
      for (const path of parsedSection.unknownPaths) {
        lostFromFileCount += countMeaningfulFields(getValueAtPath(parsedSection.migratedValue, path));
        dataLossIssues.push({
          kind: 'strippedUnknownField',
          path: toLoadIssuePath(sectionKey, path),
          reason: 'Feltet findes ikke i denne version og blev sat til standardværdien',
        });
      }
      continue;
    }

    // Hele sektionen kunne ikke valideres → den indlæses ikke (fail-closed), og alle udfyldte
    // felter i den går tabt. Vi viser kun sektion-droppet (ikke også de enkelte strippede felter),
    // så tabs-tallet ikke dobbelttælles.
    lostFromFileCount += countMeaningfulFields(rawValue);
    const firstIssue = parsedSection.error.issues[0];
    const issuePathSegments = (firstIssue?.path ?? [])
      .filter((segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number');
    const detailPath = formatPathSegments(issuePathSegments);
    const issuePath = detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
    dataLossIssues.push({
      kind: 'sectionDropped',
      path: issuePath,
      reason: `Sektionen kunne ikke indlæses (${firstIssue?.message ?? 'Forkert format'}) og blev ikke indlæst`,
    });
  }

  for (const key of Object.keys(fileData as Record<string, unknown>)) {
    if (key.startsWith('_')) continue;
    if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, key)) {
      lostFromFileCount += countMeaningfulFields((fileData as Record<string, unknown>)[key]);
      dataLossIssues.push({
        kind: 'unknownSection',
        path: key,
        reason: 'Sektionen findes ikke i denne version og blev ikke indlæst',
      });
    }
  }

  const loadedFieldCount = countFilledFields(snapshot as unknown as Record<string, unknown>);
  if (loadedFieldCount === 0) {
    throw new Error('Filen indeholder ingen data der kan indlæses i denne version');
  }

  // Preflight-tallene opgøres KONSISTENT, så regnestykket går op for brugeren:
  //   indlæst-fra-fil + ikke-indlæst = felter-i-fil.
  // `loadedFromFileCount` tæller kun felter der faktisk kom fra filen (ikke schema-defaults der
  // udfylder huller i en gammel fil), ellers ville "indlæst" kunne være ≥ "forventet" trods tab.
  const notLoadedFromFileCount = Math.min(fileFieldCount, lostFromFileCount);
  const loadedFromFileCount = Math.max(0, fileFieldCount - notLoadedFromFileCount);

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
    preflightWarning: dataLossIssues.length > 0
      ? {
        expectedCount: fileFieldCount,
        loadedCount: loadedFromFileCount,
        failedCount: notLoadedFromFileCount,
        issues: dataLossIssues,
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
        const sizeMB = formatAsAmount(file.size / (1024 * 1024), 1);
        const maxSizeMB = formatAsAmount(MAX_FILE_SIZE / (1024 * 1024), 0);
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
        const sizeMB = formatAsAmount(file.size / (1024 * 1024), 1);
        const maxSizeMB = formatAsAmount(MAX_FILE_SIZE / (1024 * 1024), 0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
      }
      fileContent = await readFile(file);
    }

    const fileContainer = await decodeEoFile(fileContent);
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
    // Tjek/gen-anmod om læse-tilladelse, før vi læser fra en (muligvis gammel, persisteret) handle.
    // Ellers ville en revoked PWA-handle kaste en rå NotAllowedError → kryptisk teknisk fejl til brugeren.
    await ensureFileHandleReadPermission(fileHandle);

    const file = await fileHandle.getFile();

    if (!file.name.toLowerCase().endsWith('.eo')) {
      throw new Error('Valgt fil er ikke en .eo fil');
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = formatAsAmount(file.size / (1024 * 1024), 1);
      const maxSizeMB = formatAsAmount(MAX_FILE_SIZE / (1024 * 1024), 0);
      throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
    }
    const fileContent = await readFromFileHandle(fileHandle);

    const fileContainer = await decodeEoFile(fileContent);
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

    // Revoked/manglende tilladelse eller flyttet/slettet fil: vis en handlingsanvisende dansk besked
    // i stedet for en rå DOMException. Ingen sagsdata røres (vi fejler før apply).
    if (error instanceof FileHandleAccessError) {
      logWarning('Hent (handle) afvist pga. manglende fil-tilladelse', { context: 'loadFromFileHandle.permission' });
      throw error;
    }
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      logWarning('Hent (handle) afvist af browseren', { context: 'loadFromFileHandle.permission', data: { name: error.name } });
      throw new FileHandleAccessError('Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.', { cause: error });
    }
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      logWarning('Hent (handle) fejlede: filen blev ikke fundet', { context: 'loadFromFileHandle.notFound' });
      throw new FileHandleAccessError('Filen blev ikke fundet — den er måske flyttet eller slettet. Vælg filen igen via Hent.', { cause: error });
    }

    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
    logError('Hent-operation fejlede', { context: 'loadFromFileHandle', error: error instanceof Error ? error : undefined });

    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};
