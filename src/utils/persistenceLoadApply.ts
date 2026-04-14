import { persistenceSchemas } from '../config/persistenceRegistry';
import { type StorageKey } from '../config/storageManifest';
import type { ReplaceAllPersistedData } from '../contexts/FormPersistenceContext.shared';
import type { LoadFileResult } from '../types/fileOperations';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from './fileHandleStorage';
import { persistLoadedFilenameMetadata } from './filePersistenceMetadata';
import { clearPendingPwaFileOpenRequest, markPendingPwaFileOpenRequestHandled } from './pwaLaunchQueue';

const buildAuthoritativeLoadSnapshot = (
  partialSnapshot: Partial<Record<StorageKey, unknown>> | undefined
): Record<StorageKey, unknown | undefined> => {
  if (!partialSnapshot) {
    throw new Error('Kunne ikke anvende indlæst data: mangler snapshot');
  }

  return (Object.keys(persistenceSchemas) as StorageKey[]).reduce((acc, key) => {
    acc[key] = partialSnapshot[key];
    return acc;
  }, {} as Record<StorageKey, unknown | undefined>);
};

export const executePersistenceLoadApply = async (args: {
  result: LoadFileResult;
  replaceAllPersistedData: ReplaceAllPersistedData;
}): Promise<void> => {
  const { result, replaceAllPersistedData } = args;
  const fullSnapshot = buildAuthoritativeLoadSnapshot(result.snapshot);

  try {
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
      await saveFileHandleToIndexedDB(result.fileHandle);
    } else {
      await deleteFileHandleFromIndexedDB();
    }

    if (result.requestId) {
      await markPendingPwaFileOpenRequestHandled(result.requestId);
      return;
    }

    await clearPendingPwaFileOpenRequest();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Indlæsning blev anvendt, men efterfølgende load-metadata kunne ikke synkroniseres.\n\n${message}`);
  }
};
