import { PERSISTED_SECTION_KEYS, type PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import { type StorageKey } from '../config/storageManifest';
import type { ReplaceAllPersistedData } from '../contexts/FormPersistenceContext.shared';
import type { ApplicableLoadFileResult } from '../types/fileOperations';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from './fileHandleStorage';
import { persistLoadedFilenameMetadata } from './filePersistenceMetadata';
import { clearPendingPwaFileOpenRequest, markPendingPwaFileOpenRequestHandled } from './pwaLaunchQueue';

const buildAuthoritativeLoadSnapshot = (
  partialSnapshot: Partial<Record<StorageKey, unknown>> | undefined
): PersistedSectionsSnapshot => {
  if (!partialSnapshot) {
    throw new Error('Kunne ikke anvende indlæst data: mangler snapshot');
  }

  const assignSnapshotValue = <K extends StorageKey>(
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

export const executePersistenceLoadApply = async (args: {
  result: ApplicableLoadFileResult;
  replaceAllPersistedData: ReplaceAllPersistedData;
}): Promise<PersistenceLoadApplyResult> => {
  const { result, replaceAllPersistedData } = args;
  const fullSnapshot = buildAuthoritativeLoadSnapshot(result.snapshot);

  try {
    // result.snapshot er pre-valideret af fileLoad-pipelinen. Denne funktion ejer kun
    // atomisk apply af det autoritative snapshot og efterfølgende metadata-synkronisering.
    replaceAllPersistedData(fullSnapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Indlæsning mislykkedes. Ingen data blev anvendt.\n\n${message}`);
  }

  try {
    persistLoadedFilenameMetadata({
      filename: result.filename,
      stamdata: result.snapshot?.stamdata,
    });

    if (result.fileHandle) {
      const saved = await saveFileHandleToIndexedDB(result.fileHandle);
      if (!saved) throw new Error('Filhåndtaget kunne ikke gemmes til senere direkte Gem.');
    } else {
      const deleted = await deleteFileHandleFromIndexedDB();
      if (!deleted) throw new Error('Det tidligere filhåndtag kunne ikke ryddes.');
    }

    if (result.requestId) {
      await markPendingPwaFileOpenRequestHandled(result.requestId);
    } else {
      await clearPendingPwaFileOpenRequest();
    }
    return { status: 'applied' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return {
      status: 'applied-with-metadata-error',
      message: `Sagen blev indlæst, men filnavn, filhåndtag eller efterfølgende direkte gem kunne ikke synkroniseres.\n\n${message}`,
    };
  }
};
