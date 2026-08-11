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

const SAVED_FILENAME_BASIS_KEYS = new Set<keyof SavedFilenameBasis>([
  'skadelidte',
  'skadestype',
  'skadedato',
]);

const isSavedFilenameBasis = (value: unknown): value is SavedFilenameBasis => {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, entry]) =>
    SAVED_FILENAME_BASIS_KEYS.has(key as keyof SavedFilenameBasis)
    && (entry === undefined || typeof entry === 'string')
  );
};

export const loadStoredFilenameBasis = (): SavedFilenameBasis | null => {
  const stored = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (isSavedFilenameBasis(parsed)) return parsed;
    removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    return null;
  } catch {
    // Korrupt UI-metadata må aldrig blokere persistence-flow, men må heller ikke bruges som
    // bevis for at et gammelt file handle fortsat peger på den aktuelle sag.
    removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    return null;
  }
};

export const isKnownSavedFilenameBasis = (value: unknown): value is SavedFilenameBasis =>
  isSavedFilenameBasis(value);

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

type OptionalMetadataKey = Parameters<typeof writeOptionalSessionStorageValue>[0];

type MetadataUpdate = Readonly<{
  key: OptionalMetadataKey;
  value: string | null;
}>;

/**
 * Anvender metadataændringer som én lille rollback-transaktion. Filnavn og basis
 * bruges sammen ved næste Gem; et delvist write-resultat må derfor ikke efterlade
 * et nyt filnavn koblet til gammelt stamdatagrundlag.
 */
const applyMetadataUpdates = (updates: readonly MetadataUpdate[]): void => {
  const previous = updates.map((update) => ({
    key: update.key,
    value: readOptionalSessionStorageValue(update.key),
  }));

  const write = (update: MetadataUpdate): void => {
    const succeeded = update.value === null
      ? removeOptionalSessionStorageValue(update.key)
      : writeOptionalSessionStorageValue(update.key, update.value);
    if (!succeeded) {
      throw new Error('Browserens midlertidige lager kunne ikke opdatere filnavnsoplysninger.');
    }
  };

  try {
    updates.forEach(write);
  } catch (error) {
    try {
      previous.forEach(write);
    } catch (rollbackError) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Filnavnsoplysninger kunne ikke opdateres.'} `
        + 'Den tidligere metadata kunne heller ikke gendannes sikkert.',
        { cause: rollbackError },
      );
    }
    throw error;
  }
};

// Save-flow skriver begge værdier ubetinget, fordi det valgte filnavn bliver
// det nye autoritative grundlag for efterfølgende overwrite-beslutninger.
export const persistSavedFilenameMetadata = (filename: string, stamdata: unknown): void => {
  const basis = JSON.stringify(buildFilenameBasisFromStamdata(stamdata));
  applyMetadataUpdates([
    { key: UI_STORAGE_KEYS.lastSavedFilename, value: filename },
    { key: UI_STORAGE_KEYS.lastSavedFilenameBasis, value: basis },
  ]);
};

// Load/apply-flow bevarer et eksisterende filnavn, når intet kom fra load-resultatet,
// men genberegner grundlaget ud fra de indlæste stamdata, så fremtidige save-beslutninger følger
// de importerede sagsdata frem for forældede lokale metadata.
export const persistLoadedFilenameMetadata = (args: {
  filename?: string;
  stamdata?: unknown;
}): void => {
  const { filename, stamdata } = args;

  const basis = buildFilenameBasisFromStamdata(stamdata);
  const hasAnyBasisValue = Object.values(basis).some((value) => typeof value === 'string' && value.trim() !== '');
  const updates: MetadataUpdate[] = [];
  if (filename) updates.push({ key: UI_STORAGE_KEYS.lastSavedFilename, value: filename });
  updates.push({
    key: UI_STORAGE_KEYS.lastSavedFilenameBasis,
    value: hasAnyBasisValue ? JSON.stringify(basis) : null,
  });
  applyMetadataUpdates(updates);
};
