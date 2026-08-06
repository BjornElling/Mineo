import { logWarning } from '../logger';
import { isRecord } from '../typeGuards';

/**
 * Permission-verifikation af File System Access-handles.
 *
 * Adskilt fra kv-storet (`fileHandleKvStore.ts`), fordi det er et andet concern: intet her
 * rører IndexedDB. Det lå tidligere som ~130 linjer midt i `fileHandleStorage.ts` mellem de
 * ti IndexedDB-funktioner, hvilket gjorde filen til to urelaterede ansvar i én.
 *
 * Fælles regel for begge funktioner: et handle kan blive ugyldigt uden varsel (filen slettet,
 * mappen flyttet, tilladelse tilbagekaldt), så verifikationen er altid fail-safe og returnerer
 * et negativt resultat frem for at kaste.
 */
export type FileHandleVerificationResult = Readonly<
  | { valid: true }
  | {
      valid: false;
      reason:
        | 'missing_handle'
        | 'missing_permission_api'
        | 'not_found'
        | 'permission_denied'
        | 'permission_api_failed'
        | 'file_access_failed'
        | 'validation_failed';
      detail?: string;
    }
>;

/**
 * Validerer at et gemt file handle stadig er gyldigt og har adgang
 * Tjekker både permissions OG at filen stadig eksisterer
 *
 * @param {FileSystemFileHandle} handle - File handle der skal valideres
 * @returns {Promise<FileHandleVerificationResult>} Resultat med konkret årsag ved fejl
 */
export const verifyFileHandleDetailed = async (
  handle: FileSystemFileHandle | null | undefined,
  options: Readonly<{ allowRequestPermission?: boolean }> = {}
): Promise<FileHandleVerificationResult> => {
  try {
    if (!handle) {
      return { valid: false, reason: 'missing_handle' };
    }
    type PermissionCapableHandle = FileSystemFileHandle & {
      queryPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
      requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    const permissionHandle = handle as Partial<PermissionCapableHandle>;
    if (typeof permissionHandle.queryPermission !== 'function') {
      return { valid: false, reason: 'missing_permission_api' };
    }

    try {
      let permission = await permissionHandle.queryPermission({ mode: 'readwrite' });

      if (
        permission !== 'granted' &&
        options.allowRequestPermission === true &&
        typeof permissionHandle.requestPermission === 'function'
      ) {
        permission = await permissionHandle.requestPermission({ mode: 'readwrite' });
      }

      if (permission !== 'granted') {
        return {
          valid: false,
          reason: 'permission_denied',
          detail: `permission=${permission}`,
        };
      }

      // Når write-adgang er bekræftet, tjekker vi at filen stadig eksisterer.
      await handle.getFile();

      return { valid: true };

    } catch (permError: unknown) {
      const errName = permError instanceof Error ? permError.name : isRecord(permError) ? String(permError.name ?? '') : undefined;
      const errMessage = permError instanceof Error ? permError.message : isRecord(permError) ? String(permError.message ?? '') : undefined;

      if (errName === 'NotFoundError') {
        logWarning('Fil blev ikke fundet - er sandsynligvis blevet slettet eller flyttet');
        return { valid: false, reason: 'not_found', detail: errMessage };
      }
      if (errName === 'NotAllowedError') {
        return { valid: false, reason: 'permission_denied', detail: errMessage };
      }

      logWarning('Permission API eller file handle-validering fejlede', {
        context: 'verifyFileHandle.permissionCheck',
        data: {
          errorName: errName,
          errorMessage: errMessage,
        },
      });
      return {
        valid: false,
        reason: 'permission_api_failed',
        detail: errMessage ?? errName,
      };
    }

  } catch (error: unknown) {
    logWarning('File handle validering fejlede', {
      context: 'verifyFileHandle',
      data: {
        errorName: error instanceof Error ? error.name : isRecord(error) ? String(error.name ?? '') : undefined,
        errorMessage: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : undefined,
      },
    });
    return {
      valid: false,
      reason: 'validation_failed',
      detail: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : String(error),
    };
  }
};

export const verifyFileHandle = async (handle: FileSystemFileHandle | null | undefined): Promise<boolean> => {
  const result = await verifyFileHandleDetailed(handle);
  return result.valid;
};
/**
 * Verificerer at et directory handle stadig er gyldigt og har adgang
 * Tjekker permissions og at mappen stadig eksisterer
 *
 * @param {FileSystemDirectoryHandle} handle - Directory handle der skal valideres
 * @returns {Promise<boolean>} True hvis handle er gyldigt og mappen eksisterer
 */
export const verifyDirectoryHandle = async (
  handle: FileSystemDirectoryHandle,
  options: Readonly<{ mode?: 'read' | 'readwrite'; allowRequestPermission?: boolean }> = {}
): Promise<boolean> => {
  try {
    if (!handle || !handle.queryPermission) {
      return false;
    }

    const mode = options.mode ?? 'read';
    const requestPermission = typeof handle.requestPermission === 'function'
      ? handle.requestPermission.bind(handle)
      : null;

    // Tjek om vi har den nødvendige adgang for at bruge handle som picker-startmappe.
    // Hvis kaldet sker fra en direkte brugergestus-handler, må vi bede browseren om tilladelse
    // i stedet for at falde tilbage til skrivebordet ved permission='prompt'.
    try {
      let permission = await handle.queryPermission({ mode });

      if (
        permission !== 'granted' &&
        options.allowRequestPermission === true &&
        requestPermission
      ) {
        permission = await requestPermission({ mode });
      }

      return permission === 'granted';

    } catch (permError: unknown) {
      // Permission kan fejle hvis mappen er slettet
      const permErr = permError instanceof Error ? permError : isRecord(permError) ? permError : null;
      logWarning('Directory permission tjek fejlede', {
        context: 'verifyDirectoryHandle.permissionCheck',
        data: {
          errorName: permErr instanceof Error ? permErr.name : isRecord(permErr) ? String(permErr.name ?? '') : undefined,
          errorMessage: permErr instanceof Error ? permErr.message : isRecord(permErr) ? String(permErr.message ?? '') : undefined,
        },
      });
      return false;
    }

  } catch (error: unknown) {
    logWarning('Directory handle validering fejlede', {
      context: 'verifyDirectoryHandle',
      data: {
        errorName: error instanceof Error ? error.name : isRecord(error) ? String(error.name ?? '') : undefined,
        errorMessage: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : undefined,
      },
    });
    return false;
  }
};
