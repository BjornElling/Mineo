import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from './safeSessionStorage';
import { isRecord } from './typeGuards';

export type SavedFilenameBasis = {
  skadelidte?: string;
  skadestype?: string;
  skadedato?: string;
};

export const loadStoredFilenameBasis = (): Record<string, unknown> | null => {
  const stored = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? parsed : null;
  } catch {
    // Korrupt UI-metadata maa aldrig blokere persistence-flow.
    removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    return null;
  }
};

export const buildFilenameBasisFromStamdata = (stamdata: unknown): SavedFilenameBasis => {
  const stamdataRecord: Record<string, unknown> =
    isRecord(stamdata)
      ? stamdata
      : {};

  return {
    skadelidte: typeof stamdataRecord.skadelidte === 'string' ? stamdataRecord.skadelidte : undefined,
    skadestype: typeof stamdataRecord.skadestype === 'string' ? stamdataRecord.skadestype : undefined,
    skadedato: typeof stamdataRecord.skadedato === 'string' ? stamdataRecord.skadedato : undefined,
  };
};

// Save-flow writes both values unconditionally because the chosen filename becomes
// the new authoritative basis for subsequent overwrite decisions.
export const persistSavedFilenameMetadata = (filename: string, stamdata: unknown): void => {
  writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename, filename);
  writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis, JSON.stringify(buildFilenameBasisFromStamdata(stamdata)));
};

// Load/apply-flow preserves an existing filename when none came from the load result,
// but recalculates the basis from the loaded stamdata so future save decisions follow
// the imported case data rather than stale local metadata.
export const persistLoadedFilenameMetadata = (args: {
  filename?: string;
  stamdata?: unknown;
}): void => {
  const { filename, stamdata } = args;

  if (filename) {
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename, filename);
  }

  const basis = buildFilenameBasisFromStamdata(stamdata);
  const hasAnyBasisValue = Object.values(basis).some((value) => typeof value === 'string' && value.trim() !== '');

  if (hasAnyBasisValue) {
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis, JSON.stringify(basis));
    return;
  }

  removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
};
