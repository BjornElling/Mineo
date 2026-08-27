import { countFilledFields, countMeaningfulFields } from './dataCollection';
import { type ResolvedDirectory } from './fileHelpers';
import {
  logWarning,
  logError,
} from './logger';
import { LEGACY_PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { persistenceSchemas, PERSISTED_SECTION_KEYS, type PersistedSectionKey } from '../config/persistenceRegistry';
import { FileHandleAccessError } from './fileSystemAccess';
import type { LoadFileResult, LoadIssue } from '../types/fileOperations';
import { type EoFileContainerLoad } from '../schemas/eoFileSchema';
import { decodeEoFile } from './eoFileCodec';
import { CalculationError } from './errorMessages';
import { type UnknownPath } from './persistenceLoadSanitization';
import { parseInboundPersistedSection } from './inboundPersistedSection';
import { adaptPersistedFileDataForLoad } from '../persistence/persistedLoadAdapter';
import {
  assertLoadableEoFile,
  createManualLoadSource,
  createPwaLoadSource,
  FileSelectionError,
  type LoadSource,
} from './fileLoadSource';

import { isRecord } from './typeGuards';

const formatPathSegments = (segments: readonly (string | number)[]): string => {
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

const toLoadIssuePath = (sectionKey: PersistedSectionKey, path: readonly (string | number)[]): string => {
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
  const rawFileData = fileContainer.data as Record<string, unknown>;
  // Adapteren er load-grænsens eneste sted for godkendte historiske undtagelser. Den kører før
  // optælling, så tavst ignorerede udviklingsfelter aldrig kan nå preflight-tallene.
  const fileData = adaptPersistedFileDataForLoad(rawFileData);
  const sourcePersistedDataVersion =
    fileContainer._metadata.persistedDataVersion ?? LEGACY_PERSISTED_DATA_VERSION;

  const fileVersion = fileContainer.version;

  const fileFieldCount = countFilledFields(fileData as unknown as Record<string, unknown>);
  if (fileFieldCount === 0) {
    throw new Error('Filen indeholder ingen udfyldte felter');
  }

  const sectionsPresent = PERSISTED_SECTION_KEYS.filter(
    (k) => Object.prototype.hasOwnProperty.call(fileData, k) && (fileData as Record<string, unknown>)[k] !== undefined
  );

  // Felter/sektioner, hvor gemt brugerdata IKKE kunne indlæses og derfor er sat til standardværdier.
  // Disse rapporteres til brugeren via preflight – stille datatab er uacceptabelt (AGENTS.md save/load,
  // persistence-contract §6.3 "Rapportér tab eller strip via preflight").
  const dataLossIssues: LoadIssue[] = [];
  // Antal udfyldte felter fra filen der gik tabt (strippet, droppet sektion eller ukendt sektion).
  // Migreringer bevarer data og tæller derfor IKKE som tab.
  let lostFromFileCount = 0;

  const snapshot: Partial<Record<PersistedSectionKey, unknown>> = {};
  for (const sectionKey of PERSISTED_SECTION_KEYS) {
    const rawValue = (fileData as Record<string, unknown>)[sectionKey];
    if (rawValue === undefined) {
      continue;
    }

    // Den trust-kritiske inbound-kæde (migrator → sanitize → schema-parse) deles med session-hydrering
    // via parseInboundPersistedSection, så samme rå sektionsdata aldrig kan transformeres forskelligt
    // afhængigt af kilden. En migrator flytter/omsætter kendte gamle felter til current struktur – det er
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
        const lostFieldCount = countMeaningfulFields(getValueAtPath(parsedSection.migratedValue, path));
        // En ældre fil kan bære et fjernet, TOMT schema-slot. Det er ikke brugerdata og må ikke
        // alene udløse preflight – kontraktens tolerante load gælder alle faktisk tilstedeværende
        // værdier, ikke historiske tomme strukturrester.
        if (lostFieldCount === 0) continue;
        lostFromFileCount += lostFieldCount;
        dataLossIssues.push({
          kind: 'strippedUnknownField',
          path: toLoadIssuePath(sectionKey, path),
          reason: 'Feltet findes ikke i denne version og blev sat til standardværdien',
        });
      }
      for (const path of parsedSection.invalidPaths) {
        const lostFieldCount = countMeaningfulFields(getValueAtPath(parsedSection.migratedValue, path));
        if (lostFieldCount === 0) continue;
        lostFromFileCount += lostFieldCount;
        dataLossIssues.push({
          kind: 'invalidField',
          path: toLoadIssuePath(sectionKey, path),
          reason: 'Feltet havde et ugyldigt format og blev sat til standardværdien',
        });
      }
      for (const missingField of parsedSection.preflightMissingFields) {
        dataLossIssues.push({
          kind: 'missingHistoricalField',
          path: toLoadIssuePath(sectionKey, missingField.path),
          reason: missingField.reason,
        });
      }
      continue;
    }

    // Hele sektionen kunne ikke valideres → den indlæses ikke (fail-closed), og alle udfyldte
    // felter i den går tabt. Vi viser kun sektion-droppet (ikke også de enkelte strippede felter),
    // så tabs-tallet ikke dobbelttælles.
    const lostSectionFieldCount = countMeaningfulFields(rawValue);
    lostFromFileCount += lostSectionFieldCount;
    const firstIssue = parsedSection.error.issues[0];
    const issuePathSegments = (firstIssue?.path ?? [])
      .filter((segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number');
    const detailPath = formatPathSegments(issuePathSegments);
    const issuePath = detailPath === '(root)' ? sectionKey : `${sectionKey}.${detailPath}`;
    if (lostSectionFieldCount > 0) {
      dataLossIssues.push({
        kind: 'sectionDropped',
        path: issuePath,
        reason: `Sektionen kunne ikke indlæses (${firstIssue?.message ?? 'Forkert format'}) og blev ikke indlæst`,
      });
    }
  }

  for (const key of Object.keys(fileData as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, key)) {
      const lostSectionFieldCount = countMeaningfulFields((fileData as Record<string, unknown>)[key]);
      lostFromFileCount += lostSectionFieldCount;
      if (lostSectionFieldCount > 0) {
        dataLossIssues.push({
          kind: 'unknownSection',
          path: key,
          reason: 'Sektionen findes ikke i denne version og blev ikke indlæst',
        });
      }
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

  const loadedData = {
    source,
    requestId,
    filename,
    fileHandle,
    fieldCount: loadedFieldCount,
    // Metadatafeltet i den gamle fil kan tælle tavst ignorerede felter. Det udleverede load-tal
    // skal derfor være det samme rensede tal, som preflight bruger – ikke den rå metadata-værdi.
    expectedFieldCount: fileFieldCount,
    sections: sectionsPresent.length,
    version: fileVersion,
    snapshot,
  } as const;

  if (dataLossIssues.length > 0) {
    return {
      status: 'preflight',
      ...loadedData,
      preflightWarning: {
        expectedCount: fileFieldCount,
        loadedCount: loadedFromFileCount,
        failedCount: notLoadedFromFileCount,
        issues: dataLossIssues,
      },
    };
  }

  return { status: 'loaded', ...loadedData };
};

/**
 * Kanonisk indlæsnings-flow bag en typet {@link LoadSource}. Ejer den delte, kilde-uafhængige kæde:
 * åbn kilde → (annulleret? stop) → valider `.eo`-fil → læs bytes → afkod container → processér.
 * Fejl kastes videre til entrypointets kilde-specifikke mapping (manuel vs. PWA).
 */
const loadFromSource = async (source: LoadSource): Promise<LoadFileResult> => {
  const outcome = await source.open();
  if (outcome.status === 'cancelled') {
    return { status: 'cancelled', source: outcome.source };
  }

  assertLoadableEoFile(outcome.file);
  const fileContent = await outcome.readContent();
  const fileContainer = await decodeEoFile(fileContent);
  return processDecryptedContainer({
    fileContainer,
    filename: outcome.file.name,
    source: outcome.source,
    fileHandle: outcome.fileHandle,
    requestId: outcome.requestId,
  });
};

/**
 * Den kilde-uafhængige fejl-hale delt af begge load-entrypoints: forventelige afvisninger fra
 * filvælgerens validering og allerede-mappede `FILE_LOAD_FAILED`-fejl passeres uændret videre.
 * Enhver anden fejl CPR-maskeres, logges og kastes som en generisk dansk indlæsnings-fejl.
 * Kilde-specifik mapping (fx PWA-handle-tilladelse) skal ske FØR denne kaldes.
 */
const mapGenericLoadError = (error: unknown, context: string): never => {
  if (error instanceof FileSelectionError) {
    throw error;
  }

  if (error instanceof CalculationError && error.code === 'FILE_LOAD_FAILED') {
    throw error;
  }

  const message = error instanceof Error ? error.message : 'Ukendt fejl';
  const safeErrorMessage = message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]');
  logError('Hent-operation fejlede', { context, error: error instanceof Error ? error : undefined });

  throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
};

export const loadFromFile = async (
  resolvedDirectory?: ResolvedDirectory
): Promise<LoadFileResult> => {

  try {
    return await loadFromSource(createManualLoadSource(resolvedDirectory));
  } catch (error: unknown) {
    return mapGenericLoadError(error, 'loadFromFile');
  }
};

export const loadFromFileHandle = async (
  fileHandle: FileSystemFileHandle,
  options?: { requestId?: string }
): Promise<LoadFileResult> => {

  try {
    return await loadFromSource(createPwaLoadSource(fileHandle, options?.requestId));
  } catch (error: unknown) {
    // Kilde-specifik mapping FØRST: revoked/manglende tilladelse eller flyttet/slettet fil vises
    // som en handlingsanvisende dansk besked i stedet for en rå DOMException. Ingen sagsdata røres
    // (vi fejler før apply).
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
      throw new FileHandleAccessError('Filen blev ikke fundet – den er måske flyttet eller slettet. Vælg filen igen via Hent.', { cause: error });
    }

    return mapGenericLoadError(error, 'loadFromFileHandle');
  }
};
