import { PERSISTED_SECTION_KEYS, type PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import type { ApplicableLoadFileResult } from '../types/fileOperations';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from './fileHandleStorage';
import { persistLoadedFilenameMetadata } from './filePersistenceMetadata';
import { markPendingPwaFileOpenRequestHandled } from './pwaLaunchQueue';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  readSessionStorageValue,
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from './safeSessionStorage';

const invalidateSavedFilenameBasis = (): string | null => {
  const previous = readSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
  if (previous !== null && !removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis)) {
    throw new Error('Browserens midlertidige lager kunne ikke opdatere filnavnsoplysninger.');
  }
  return previous;
};

const buildAuthoritativeLoadSnapshot = (
  partialSnapshot: Partial<Record<PersistedSectionKey, unknown>> | undefined
): PersistedSectionsSnapshot => {
  if (!partialSnapshot) {
    throw new Error('Kunne ikke anvende indlæst data: mangler snapshot');
  }

  const assignSnapshotValue = <K extends PersistedSectionKey>(
    target: PersistedSectionsSnapshot,
    key: K,
    value: PersistedSectionsSnapshot[K]
  ): void => {
    target[key] = value;
  };

  return PERSISTED_SECTION_KEYS.reduce((acc, key) => {
    // Cast er kun sikkert fordi replaceAllPersistedData re-validerer hver sektion med Zod før apply
    // (denne funktion validerer ikke selv). Snapshot-værdierne er allerede pre-valideret af fileLoad.
    assignSnapshotValue(acc, key, partialSnapshot[key] as PersistedSectionsSnapshot[typeof key]);
    return acc;
  }, {} as PersistedSectionsSnapshot);
};

export type PersistenceLoadApplyResult =
  | { status: 'applied' }
  | { status: 'applied-with-metadata-error'; message: string };

/**
 * Anvender ét autoritativt, pre-valideret sektionssnapshot atomisk. Input-runtime binder dette til
 * `CaseFileOperations.applyLoadedSnapshot` (→ `replaceCase` gennem coordinatoren, §3.10). Kaster ved
 * schema-/katalogafvisning, så apply-fejl aldrig efterlader en delvist erstattet sag.
 */
export type ApplyLoadedSnapshot = (snapshot: PersistedSectionsSnapshot) => void;

/**
 * Den SYNKRONE, autoritative halvdel af et load-apply. Skal køre inde i
 * `CriticalActionCoordinator.applyReplacement`, så replacement-transaktionen og draft-discard er atomiske.
 * Kaster ved schema-/katalogafvisning, så apply-fejl aldrig efterlader en delvist erstattet sag –
 * og fordi den kaster INDE i barrieren, bevares den åbne draft.
 */
export const applyAuthoritativeLoadSnapshot = (args: {
  result: ApplicableLoadFileResult;
  applySnapshot: ApplyLoadedSnapshot;
}): void => {
  const { result, applySnapshot } = args;
  // result.snapshot er pre-valideret af fileLoad-pipelinen.
  const fullSnapshot = buildAuthoritativeLoadSnapshot(result.snapshot);

  let previousBasis: string | null = null;
  let invalidated = false;
  try {
    // Samme filnavn og stamdata beviser ikke, at den indlæste fil er det gamle
    // gem-mål. Fjern koblingen før sagsinput ændres, også hvis browseren genindlæses.
    previousBasis = invalidateSavedFilenameBasis();
    invalidated = true;
    applySnapshot(fullSnapshot);
  } catch (error) {
    if (invalidated && previousBasis !== null) {
      // Apply-fejl bevarer den gamle sag. Mislykkes rollback af metadata, er en
      // ekstra filvælger næste gang sikker; det ukendte mål må ikke godkendes.
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis, previousBasis);
    }
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Indlæsning mislykkedes. Ingen data blev anvendt.\n\n${message}`, { cause: error });
  }
};

/**
 * Den ASYNKRONE metadata-halvdel: filnavn, filhåndtag og PWA-request-oprydning (§4.1). Kører EFTER
 * replacement-barrieren er lukket, fordi den ikke ejer sagsinput og derfor ikke må holde draft-discard åben
 * mens brugeren kan begynde at redigere den netop indlæste sag. En fejl her er ikke en apply-fejl:
 * sagen ER indlæst, og brugeren får en advarsel om den manglende synkronisering.
 */
export const synchronizeLoadMetadata = async (
  result: ApplicableLoadFileResult
): Promise<PersistenceLoadApplyResult> => {
  // Den nye sag er allerede anvendt. Den gamle kobling må heller ikke genbruges,
  // når filerne har samme navn og stamdata, eller når PWA-ack fejler før handle-write.
  let invalidationError: Error | null = null;
  try {
    invalidateSavedFilenameBasis();
  } catch (error) {
    invalidationError = error instanceof Error ? error : new Error('Ukendt fejl');
  }

  // En PWA-request er forbrugt, så snart den autoritative replacement er lykkedes. Metadata er
  // efterfølgende device-lokal convenience; lader vi dens fejl forhindre acknowledgement, genafspilles
  // samme fil efter næste boot og kan overskrive den netop indlæste sag igen.
  if (result.requestId) {
    try {
      await markPendingPwaFileOpenRequestHandled(result.requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      return {
        status: 'applied-with-metadata-error',
        message: `Sagen blev indlæst, men PWA-filrequesten kunne ikke ryddes helt.\n\n${message}`,
      };
    }
  }

  try {
    if (invalidationError !== null) throw invalidationError;
    // Handle/metadata er et samlet overwrite-target. Den tidligere basis er ugyldiggjort
    // ovenfor; en fejl i et af lagene må derfor ikke godkende det gamle mål igen.
    if (result.fileHandle) {
      const saved = await saveFileHandleToIndexedDB(result.fileHandle);
      if (!saved) throw new Error('Filhåndtaget kunne ikke gemmes til senere direkte Gem.');
    } else {
      const deleted = await deleteFileHandleFromIndexedDB();
      if (!deleted) throw new Error('Det tidligere filhåndtag kunne ikke ryddes.');
    }

    persistLoadedFilenameMetadata({
      filename: result.filename,
      stamdata: result.snapshot?.stamdata,
      fingerprint: result.fileFingerprint,
    });

    return { status: 'applied' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return {
      status: 'applied-with-metadata-error',
      message: `Sagen blev indlæst, men filnavn, filhåndtag eller efterfølgende direkte gem kunne ikke synkroniseres.\n\n${message}`,
    };
  }
};
