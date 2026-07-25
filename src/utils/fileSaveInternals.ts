import { eoFileContainerSchema } from '../schemas/eoFileSchema';
import { persistenceSchemas } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { decryptFromString } from './encryption';
import { isFileSystemFileHandle, readFromFileHandle } from './fileSystemAccess';
import { logError, logWarning } from './logger';
import type {
  SaveSnapshot,
  CanonicalEoData,
  VerificationResult,
} from './fileSaveTypes';

import { isRecord } from './typeGuards';

const getValueType = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};


export const buildAllDataRawFromSnapshot = (snapshot: SaveSnapshot): Record<string, unknown> => {
  const allowedKeys = new Set(Object.keys(persistenceSchemas) as PersistedSectionKey[]);
  for (const key of Object.keys(snapshot)) {
    if (!allowedKeys.has(key as PersistedSectionKey)) {
      throw new Error(`Snapshot indeholder ukendt key '${key}'.`);
    }
  }

  for (const key of Object.keys(persistenceSchemas) as PersistedSectionKey[]) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
      throw new Error(`Snapshot mangler key '${key}'. Gem kræver alle keys (brug undefined for at udelade en sektion).`);
    }
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(persistenceSchemas) as PersistedSectionKey[]) {
    const raw = snapshot[key];
    if (raw === null) {
      throw new Error(`Snapshot indeholder null for '${key}'. Brug undefined for at udelade en sektion.`);
    }
    if (raw === undefined) continue;
    out[key] = raw;
  }
  return out;
};

const stripUndefinedDeep = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = stripUndefinedDeep(v);
      if (next !== undefined) {
        out[k] = next;
      }
    }
    return out;
  }
  return value;
};

export const compareData = (expected: unknown, actual: unknown, path = 'root', depth = 0): string[] => {
  const differences: string[] = [];

  // Sikkerhed mod uendelig rekursion
  if (depth > 15) {
    return differences;
  }

  // Type-tjek
  const expectedType = getValueType(expected);
  const actualType = getValueType(actual);

  if (expectedType !== actualType) {
    differences.push(`${path}: Type mismatch (forventet: ${expectedType}, faktisk: ${actualType})`);
    return differences;
  }

  // Null/undefined tjek
  if (expected === null || expected === undefined) {
    return differences;
  }
  if (actual === null || actual === undefined) {
    differences.push(`${path}: Forventet værdi, fik null/undefined`);
    return differences;
  }

  // Arrays
  if (Array.isArray(expected)) {
    const actualArray = actual as unknown[];
    if (expected.length !== actualArray.length) {
      differences.push(`${path}: Array-længde afviger (forventet: ${expected.length}, faktisk: ${actualArray.length})`);
    }

    const maxLength = Math.max(expected.length, actualArray.length);
    for (let i = 0; i < maxLength; i++) {
      const itemDiffs = compareData(expected[i], actualArray[i], `${path}[${i}]`, depth + 1);
      differences.push(...itemDiffs);
    }

    return differences;
  }

  // Objekter
  if (isRecord(expected) && isRecord(actual)) {
    // Ignorér KUN top-niveau metadata-nøgler (`_metadata` m.fl.); på dybere niveauer skal alle felter
    // sammenlignes, så et brugerinput-felt med `_`-præfiks ikke usynligt kan tabes i verifikationen.
    const includeKey = (k: string): boolean => depth > 0 || !k.startsWith('_');
    const expectedKeys = Object.keys(expected).filter(includeKey).sort();
    const actualKeys = Object.keys(actual).filter(includeKey).sort();

    // Tjek for manglende nøgler
    for (const key of expectedKeys) {
      if (!actualKeys.includes(key)) {
        differences.push(`${path}.${key}: Mangler i gemt fil`);
      } else {
        const itemDiffs = compareData(expected[key], actual[key], `${path}.${key}`, depth + 1);
        differences.push(...itemDiffs);
      }
    }

    // Tjek for ekstra nøgler
    for (const key of actualKeys) {
      if (!expectedKeys.includes(key)) {
        differences.push(`${path}.${key}: Ekstra felt i gemt fil (ikke i sessionStorage)`);
      }
    }

    return differences;
  }

  // Primitive værdier
  if (expected !== actual) {
    differences.push(`${path}: Værdi afviger`);
  }

  return differences;
};

/**
 * Verificerer at en gemt fil kan læses korrekt og indeholder forventet data.
 *
 * Læser filen tilbage efter gem og validerer:
 * - At filen kan dekrypteres
 * - At data fra sessionStorage matcher data i filen (felt-for-felt via compareData)
 * - At kritiske sektioner findes
 */
export const verifyAfterSave = async (
  fileHandleOrContent: FileSystemFileHandle | string,
  expectedData: CanonicalEoData,
  isFileHandle = true
): Promise<VerificationResult> => {

  try {
    let fileContent: string;

    // Læs fil-indhold baseret på type
    if (isFileHandle) {
      // File System Access API - læs via file handle
      if (!isFileSystemFileHandle(fileHandleOrContent)) {
        throw new Error('Intern fejl: verifyAfterSave forventede et FileSystemFileHandle');
      }
      fileContent = await readFromFileHandle(fileHandleOrContent);
    } else {
      // Fallback - vi har allerede indholdet (det der lige blev "downloadet")
      if (typeof fileHandleOrContent !== 'string') {
        throw new Error('Intern fejl: verifyAfterSave forventede fil-indhold som string');
      }
      fileContent = fileHandleOrContent;
    }

    // Dekrypter filen
    let decrypted: unknown;
    try {
      decrypted = await decryptFromString(fileContent);
    } catch (error) {
      logError('⚠ KRITISK: Fil kan IKKE dekrypteres!');
      return {
        success: false,
        kind: 'unusable',
        error: 'KRITISK FEJL: Den gemte fil kan ikke dekrypteres!',
        details: error instanceof Error ? error.message : String(error),
      };
    }

    // Verificér hele den aktuelle container, ikke kun `data`. Ellers kunne en fil uden
    // korrekt data-version blive godkendt og først fejle ved en senere schema-evolution.
    const containerParsed = eoFileContainerSchema.safeParse(decrypted);
    if (!containerParsed.success) {
      logError('⚠ KRITISK: Ugyldig fil-struktur!');
      return {
        success: false,
        kind: 'unusable',
        error: 'KRITISK FEJL: Ugyldig fil-struktur i gemt fil!',
        details: containerParsed.error.message,
      };
    }

    // Kanonisér begge sider, ligesom save-pipelinen gør:
    // - anvend `.eo`-schema-normalisering (`null` -> `undefined`)
    // - drop `undefined`-nøgler (JSON.stringify udelader dem)
    const expectedCanonicalJson = stripUndefinedDeep(expectedData);
    const actualCanonicalJson = stripUndefinedDeep(containerParsed.data.data);

    // KRITISK: Sammenlign felt-for-felt
    const differences = compareData(expectedCanonicalJson, actualCanonicalJson);

    if (differences.length > 0) {
      // KRITISK FEJL: Data matcher ikke!
      logError('⚠⚠⚠ KRITISK: Data i fil matcher IKKE persistence snapshot!');
      logError(`Fandt ${differences.length} forskelle:`);

      // Log første 10 forskelle (for ikke at overvælde konsollen)
      const displayCount = Math.min(10, differences.length);
      for (let i = 0; i < displayCount; i++) {
        logError(`  ${i + 1}. ${differences[i]}`);
      }

      if (differences.length > 10) {
        logError(`  ... og ${differences.length - 10} flere forskelle`);
      }

      return {
        success: false,
        kind: 'integrity',
        error: 'KRITISK FEJL: Gemt data matcher ikke persistence snapshot!',
        details: `${differences.length} forskelle fundet`,
        differences: differences.slice(0, 20), // Maksimalt 20 til returværdi
      };
    }


    // Valider at kritiske sektioner findes
    const criticalSections = ['stamdata'];
    const actualCanonicalRecord = isRecord(actualCanonicalJson) ? actualCanonicalJson : {};
    const missingSections = criticalSections.filter((section) => {
      const sectionValue = (actualCanonicalRecord as Record<string, unknown>)[section];
      return !isRecord(sectionValue) || Object.keys(sectionValue).length === 0;
    });

    if (missingSections.length > 0) {
      logWarning(`⚠ ADVARSEL: Manglende kritiske sektioner: ${missingSections.join(', ')}`);
      return {
        success: true,
        verified: true,
        warning: true,
        message: `ADVARSEL: Manglende sektioner: ${missingSections.join(', ')}`,
      };
    }

    return {
      success: true,
      verified: true,
    };
  } catch (error) {
    logError('Verificering fejlede', {
      context: 'verifyAfterSave',
      error: error instanceof Error ? error : undefined,
    });
    const details = error instanceof Error ? error.message : 'Ukendt fejl';
    return {
      success: false,
      kind: 'unusable',
      error: 'Kunne ikke verificere gemt fil',
      details,
    };
  }
};
