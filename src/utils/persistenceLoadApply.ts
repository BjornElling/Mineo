import { PERSISTED_SECTION_KEYS, type PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import type { ApplicableLoadFileResult } from '../types/fileOperations';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from './fileHandleStorage';
import { persistLoadedFilenameMetadata } from './filePersistenceMetadata';
import { markPendingPwaFileOpenRequestHandled } from './pwaLaunchQueue';

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
  // result.snapshot er pre-valideret af fileLoad-pipelinen; denne funktion ejer kun den atomiske apply.
  const fullSnapshot = buildAuthoritativeLoadSnapshot(result.snapshot);

  try {
    applySnapshot(fullSnapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Indlæsning mislykkedes. Ingen data blev anvendt.\n\n${message}`);
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
    // Handle/metadata er et samlet overwrite-target, men IndexedDB og sessionStorage kan ikke
    // deltage i samme transaktion. Skriv derfor det potentielt fejlende IDB-led først: ved fejl
    // forbliver den gamle metadata koblet til det gamle handle, og næste Gem kan ikke genbruge en
    // delvist indlæst target-record. Metadata skrives først, når handle-leddet er bekræftet.
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
