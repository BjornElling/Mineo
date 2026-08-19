import { generateFilename, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import { logWarning } from './logger';
import {
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
  saveFileWithPicker,
} from './fileSystemAccess';
import {
  requestPersistentStorage,
  loadFileHandleFromIndexedDB,
  verifyFileHandleDetailed,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import type { EoFileContainer } from '../schemas/eoFileSchema';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  buildFilenameBasisFromStamdata,
  isKnownSavedFilenameBasis,
  loadStoredFilenameBasis,
} from './filePersistenceMetadata';
import { readOptionalSessionStorageValue } from './safeSessionStorage';

/**
 * Typet gem-port: HVOR det verificerede `.eo`-artefakt skal skrives hen.
 *
 * `saveToFile` havde tidligere en stor forgrenet blok, der blandede to concerns: (1) hvilket mål der
 * skal skrives til (genbrug persisteret handle, åbn picker, eller fallback-download) og (2) selve
 * skrivning + verifikation. Denne port ejer KUN målresolutionen og returnerer en diskrimineret værdi
 * – `fileHandle` (read-back-sink), `download` (in-memory-verificér-før-sink) eller `cancelled`
 * (brugeren lukkede pickeren / afviste tilladelses-prompten). Skrivning + verifikation ejes fortsat af
 * `saveToFile`, som blot forgrener på `target.kind`.
 */
export type SaveTarget =
  | {
      kind: 'fileHandle';
      fileHandle: FileSystemFileHandle;
      /** Om det (netop valgte) handle først skal persisteres til IndexedDB EFTER en lykket write+verify. */
      persistHandleAfterSuccess: boolean;
      /** Advarsel hvis et tidligere handle måtte kasseres, så brugeren blev sendt til pickeren. */
      fallbackWarning?: string;
    }
  | { kind: 'download'; filename: string }
  | { kind: 'cancelled' };

const hasFilenameBasisChanged = (
  previousBasis: unknown,
  nextStamdata: unknown
): boolean => {
  // Et manglende eller korrupt basis er ukendt – aldrig et bevis for lighed. Ellers kan et
  // gammelt handle genbruges til en anden sag, fordi den defensive sammenligning fejlagtigt
  // fortolker metadata-hullet som "uændret".
  if (!isKnownSavedFilenameBasis(previousBasis)) return true;
  const nextBasis = buildFilenameBasisFromStamdata(nextStamdata);
  return (
    (previousBasis as Record<string, unknown>).skadelidte !== nextBasis.skadelidte ||
    (previousBasis as Record<string, unknown>).skadestype !== nextBasis.skadestype ||
    (previousBasis as Record<string, unknown>).skadedato !== nextBasis.skadedato
  );
};

/**
 * Peger det gemte handle på den fil, DENNE fane mener at arbejde på?
 *
 * Sagsdata og `lastSavedFilename` ligger i sessionStorage, som er fanens eget; selve filhåndtaget
 * ligger i IndexedDB, som er FÆLLES for alle faner i browseren. To åbne faner er to selvstændige
 * sager, men de deler ét håndtag – og det peger altid på den SIDST rørte fil i browseren. Uden denne
 * prøve kunne fane A's `Gem` derfor skrive sin egen sag ind i den fil, fane B sidst gemte til: begge
 * de eksisterende betingelser var opfyldt (fane A's eget stamdatagrundlag er uændret, og håndtaget er
 * gyldigt og tilgængeligt), så håndtaget blev genbrugt tavst, og fane B's fil blev overskrevet uden
 * filvælger, uden advarsel og med ordet «Gemt» som kvittering.
 *
 * Sammenligningen kan laves direkte på `handle.name`, fordi det er PRÆCIS den værdi, `fileSave.ts`
 * skrev til `lastSavedFilename` ved sidste gem (`filename = target.fileHandle.name`). Der er derfor
 * intet nyt at persistere, og de to sider kan ikke komme ud af sync med hinanden.
 *
 * Passer navnene ikke, er håndtaget ikke et verificerbart overwrite-mål for denne fane, og
 * gem-flowet falder tilbage til filvælgeren med fanens eget filnavn som forslag – samme vej som når
 * håndtaget er ugyldigt. Det koster ét ekstra valg i en sjælden situation og gør en tavs
 * overskrivning af en ANDEN sag umulig.
 */
const doesHandleMatchTabFilename = (
  fileHandle: FileSystemFileHandle,
  savedFilename: string
): boolean => typeof fileHandle.name === 'string' && fileHandle.name === savedFilename;

const buildInvalidHandleUserWarning = (
  verification: Awaited<ReturnType<typeof verifyFileHandleDetailed>>
): string => {
  if (verification.valid) return '';

  switch (verification.reason) {
    case 'not_found':
      return 'Den tidligere valgte fil blev ikke fundet og kunne derfor ikke overskrives automatisk. Vælg filplacering igen.';
    case 'permission_denied':
      return 'Mineo har ikke længere adgang til den tidligere valgte fil og kunne derfor ikke overskrive den automatisk. Vælg filplacering igen.';
    case 'missing_permission_api':
    case 'permission_api_failed':
      return 'Mineo kunne ikke bekræfte adgangen til den tidligere valgte fil og kunne derfor ikke overskrive den automatisk. Vælg filplacering igen.';
    case 'file_access_failed':
    case 'validation_failed':
      return 'Den tidligere valgte fil kunne ikke bruges til automatisk overskrivning. Vælg filplacering igen.';
    case 'missing_handle':
      return 'Der var ikke længere en gemt filreference til automatisk overskrivning. Vælg filplacering igen.';
    default:
      return 'Den tidligere valgte fil kunne ikke overskrives automatisk. Vælg filplacering igen.';
  }
};

const isUserDismissedPermissionPrompt = (
  verification: Awaited<ReturnType<typeof verifyFileHandleDetailed>>
): boolean =>
  !verification.valid &&
  verification.reason === 'permission_denied' &&
  verification.detail === 'permission=prompt';

/**
 * Resolver det autoritative gem-mål ud fra det aktuelle miljø og tidligere gem-metadata.
 *
 * File System Access: genbrug et gyldigt persisteret handle når stamdata er uændret; ellers (eller ved
 * et ubrugeligt handle) åbn pickeren med et foreslået filnavn. Ingen File System Access: fallback til
 * klassisk browser-download med et stamdata-afledt eller sidst-gemt filnavn.
 */
export const resolveSaveTarget = async (
  fileData: EoFileContainer,
  resolvedDirectory?: ResolvedDirectory
): Promise<SaveTarget> => {
  if (isFileSystemAccessSupported()) {
    await requestPersistentStorage();

    const loadedHandle: unknown = await loadFileHandleFromIndexedDB();
    let fileHandle: FileSystemFileHandle | null = isFileSystemFileHandle(loadedHandle) ? loadedHandle : null;
    const savedFilePath = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename);
    const savedFilenameBasis = loadStoredFilenameBasis();
    const currentStamdata = fileData.data.stamdata || {};
    const stamdataChanged = hasFilenameBasisChanged(savedFilenameBasis, currentStamdata);
    let shouldUseExistingHandle = false;
    let fallbackWarning: string | undefined;

    if (fileHandle && savedFilePath) {
      // Vi har et gemt handle – valider det, men kun hvis filnavns-relevant stamdata er uændret OG
      // håndtaget faktisk peger på denne fanes egen fil (se `doesHandleMatchTabFilename`).
      const handleBelongsToThisTab = doesHandleMatchTabFilename(fileHandle, savedFilePath);
      if (!stamdataChanged && handleBelongsToThisTab) {
        const handleVerification = await verifyFileHandleDetailed(fileHandle, {
          allowRequestPermission: true,
        });

        if (handleVerification.valid) {
          shouldUseExistingHandle = true;
        } else if (isUserDismissedPermissionPrompt(handleVerification)) {
          return { kind: 'cancelled' };
        } else {
          fallbackWarning = buildInvalidHandleUserWarning(handleVerification);
          logWarning('Tidligere file handle kunne ikke genbruges - sletter fra IndexedDB', {
            context: 'resolveSaveTarget.invalidStoredHandle',
            data: {
              reason: handleVerification.reason,
              detail: handleVerification.detail,
            },
          });
          const deleted = await deleteFileHandleFromIndexedDB();
          if (!deleted) {
            // Et gammelt handle må ikke blive liggende, mens et nyt filnavn eventuelt gemmes:
            // ellers kan næste Gem koble de nye metadata til den gamle fil og overskrive forkert mål.
            // Fail-closed er den eneste sikre vej, når browseren ikke kan bekræfte oprydningen.
            logWarning('Gammelt file handle kunne ikke ryddes sikkert; gemning afbrudt', {
              context: 'resolveSaveTarget.failedToInvalidateStoredHandle',
            });
            return { kind: 'cancelled' };
          }
          fileHandle = null;
        }
      } else {
        // Enten er stamdata ændret (bevidst ny fil), eller håndtaget tilhører en anden fane/fil.
        // Begge veje ender i pickeren med fanens eget filnavn som forslag frem for en overskrivning.
        const deleted = await deleteFileHandleFromIndexedDB();
        if (!deleted) {
          // Samme fail-closed-regel gælder ved en bevidst ny fil: et gammelt handle må ikke kunne
          // genbruges, hvis persisteringen af det nye handle senere fejler.
          logWarning('Gammelt file handle kunne ikke ryddes sikkert; gemning afbrudt', {
            context: stamdataChanged
              ? 'resolveSaveTarget.changedFilenameBasisHandle'
              : 'resolveSaveTarget.foreignTabHandle',
          });
          return { kind: 'cancelled' };
        }
        if (!handleBelongsToThisTab) {
          // Brugeren skal vide HVORFOR filvælgeren kom, når han bad om et direkte gem. Uden en
          // forklaring ligner det en fejl i programmet – og netop her er den tavse vej den farlige.
          fallbackWarning =
            'Den senest valgte fil i browseren hører ikke til denne sag – det sker typisk, når Mineo '
            + 'er åben i flere faner. Vælg filplacering for denne sag, så en anden sags fil ikke '
            + 'overskrives.';
        }
        fileHandle = null;
      }
    } else if (fileHandle) {
      // Et handle uden tilhørende filnavn er ikke et verificerbart overwrite-mål. Kasser det før
      // picker-flowet, så manglende metadata aldrig bliver en genvej til et ukendt gammelt mål.
      const deleted = await deleteFileHandleFromIndexedDB();
      if (!deleted) {
        logWarning('Ukendt file handle kunne ikke ryddes sikkert; gemning afbrudt', {
          context: 'resolveSaveTarget.orphanedStoredHandle',
        });
        return { kind: 'cancelled' };
      }
      fileHandle = null;
    }

    if (shouldUseExistingHandle && fileHandle) {
      // Handle er gyldigt – browseren håndterer overskrivning; intet nyt at persistere.
      return { kind: 'fileHandle', fileHandle, persistHandleAfterSuccess: false };
    }

    const currentFilename = generateFilename(fileData.data);
    const suggestedFilename =
      savedFilePath && !stamdataChanged ? savedFilePath : `${currentFilename}.eo`;
    const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';
    const pickedHandle: unknown = await saveFileWithPicker(suggestedFilename, startIn);
    const picked = isFileSystemFileHandle(pickedHandle) ? pickedHandle : null;

    if (!picked) {
      // Bruger annullerede pickeren.
      return { kind: 'cancelled' };
    }

    // Persistér først EFTER lykket write+verify, så et halvt gem ikke efterlader et nyt "autoritativt"
    // overskrivnings-target i IndexedDB.
    return { kind: 'fileHandle', fileHandle: picked, persistHandleAfterSuccess: true, fallbackWarning };
  }

  // Fallback til klassisk download (Firefox m.fl.). Det er en forventet browserforskel og
  // skal derfor ikke registreres som en teknisk advarsel.

  const lastSavedPath = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename);
  const currentFilename = generateFilename(fileData.data);
  const savedStamdata = loadStoredFilenameBasis();
  const currentStamdata = fileData.data.stamdata || {};
  const stamdataChanged = hasFilenameBasisChanged(savedStamdata, currentStamdata);
  const filename = lastSavedPath && !stamdataChanged ? lastSavedPath : `${currentFilename}.eo`;

  return { kind: 'download', filename };
};
