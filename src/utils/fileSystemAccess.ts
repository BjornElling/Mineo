import { logWarning, logError, sanitizeFilenameForLog } from './logger';
import { asError, getErrorName } from './typeGuards';
import { readFileContentFingerprint } from './fileContentFingerprint';
import { MAX_FILE_SIZE } from '../config/version';
import { queryHandlePermission } from './file/handlePermissionQuery';
import { getFileSnapshot, withinFileIoDeadline } from './file/fileIoDeadline';

/**
 * Tjekker om File System Access API er tilgængelig i browseren.
 * Egenskaberne kan findes uden at være brugbare funktioner, så begge skal
 * være callable, før Hent- og Gem-flowet vælger API'et frem for fallbacken.
 */
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window.showSaveFilePicker === 'function'
    && typeof window.showOpenFilePicker === 'function';
};

/**
 * Kastet når en gemt fil-handle (typisk fra en PWA-fil-åbning efter app-genstart) ikke længere
 * har læse-tilladelse – eller filen er flyttet/slettet. Bærer en handlingsanvisende dansk besked,
 * så indlæsningslaget kan vise den direkte i stedet for en kryptisk DOMException.
 */
export class FileHandleAccessError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FileHandleAccessError';
  }
}

export class FileSaveSourceChangedError extends FileHandleAccessError {
  constructor() {
    super('Gem blev afbrudt, fordi sagen blev ændret undervejs. Prøv at gemme igen.');
    this.name = 'FileSaveSourceChangedError';
  }
}

export class FileSaveRevisionChangedError extends FileHandleAccessError {
  constructor() {
    super('Filen blev ændret igen, mens gemningen var i gang. Intet blev skrevet. Prøv Gem igen.');
    this.name = 'FileSaveRevisionChangedError';
  }
}

/** Forventelige ændringer i filsystemet vises som handlingsfejl uden teknisk runtime-alarm. */
export const toFileHandleAccessError = (error: unknown, operation: 'read' | 'write'): FileHandleAccessError | null => {
  if (error instanceof FileHandleAccessError) return error;
  const name = getErrorName(error);
  const messages: Readonly<Record<string, string>> = operation === 'read'
    ? {
        NotFoundError: 'Filen blev ikke fundet – den er måske flyttet eller slettet. Vælg filen igen via Hent.',
        NotAllowedError: 'Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.',
        SecurityError: 'Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.',
        NotReadableError: 'Filen kunne ikke læses – den kan være ændret eller i brug af et andet program. Vælg filen igen via Hent.',
        TimeoutError: 'Filen svarede ikke. Ingen data blev indlæst. Prøv Hent igen.',
        AbortError: 'Indlæsningen blev afbrudt. Ingen data blev indlæst. Prøv Hent igen.',
      }
    : {
        NotFoundError: 'Filen eller mappen blev ikke fundet – den er måske flyttet eller slettet. Prøv Gem igen, og vælg filplacering igen.',
        NotAllowedError: 'Mineo har ikke længere adgang til at gemme filen. Prøv Gem igen, og vælg en filplacering med skriveadgang.',
        SecurityError: 'Browseren tillader ikke at gemme filen her. Prøv Gem igen, og vælg filplacering igen.',
        NoModificationAllowedError: 'Filen kan ikke overskrives lige nu – den kan være skrivebeskyttet eller i brug af et andet program. Luk eventuelt filen dér, og prøv Gem igen.',
        NotReadableError: 'Filen kunne ikke kontrolleres – den kan være ændret eller i brug af et andet program. Prøv Gem igen.',
        QuotaExceededError: 'Der er ikke plads til at gemme filen. Frigør plads, eller prøv Gem igen med en anden filplacering.',
        TimeoutError: 'Filen svarede ikke. Filen er ikke bekræftet gemt. Prøv Gem igen.',
        AbortError: 'Skrivningen til filen blev afbrudt. Filen er ikke bekræftet gemt. Prøv Gem igen.',
      };
  const message = Object.hasOwn(messages, name) ? messages[name] : undefined;
  return message ? new FileHandleAccessError(message, { cause: error }) : null;
};

type FileSystemPermissionDescriptor = { mode?: 'read' | 'readwrite' };
type FileSystemHandleWithPermissions = FileSystemFileHandle & {
  queryPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
};

/**
 * Sikrer læse-tilladelse til en gemt fil-handle, før der læses fra den.
 *
 * Når en handle er persisteret (IndexedDB) og hentes frem efter en app-genstart, kan brugerens
 * read-permission være udløbet/trukket tilbage. Uden dette tjek kaster `getFile()` en rå
 * `NotAllowedError`, som ville nå brugeren som teknisk engelsk tekst. Vi forsøger derfor at
 * gen-anmode om tilladelse (kun muligt i en brugerhandling) og fejler ellers fail-closed med en
 * dansk besked. `queryPermission`/`requestPermission` er endnu ikke i alle TS DOM-libs, så de
 * tilgås via feature-detection frem for en usikker cast.
 */
export const ensureFileHandleReadPermission = async (fileHandle: FileSystemFileHandle): Promise<void> => {
  const handle = fileHandle as FileSystemHandleWithPermissions;
  if (typeof handle.queryPermission !== 'function') {
    // Ældre browser uden Permissions-API på handles: lad getFile() selv fejle (mappes i kalderen).
    return;
  }

  const queried = await queryHandlePermission({ queryPermission: handle.queryPermission.bind(handle) }, 'read');
  if (queried === 'unanswered') {
    // Samme handle ville også lade `requestPermission` hænge; fejl fail-closed med anvisningen.
    throw new FileHandleAccessError('Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.');
  }
  let state: PermissionState = queried;
  if (state === 'granted') return;

  if (typeof handle.requestPermission === 'function') {
    state = await handle.requestPermission({ mode: 'read' });
  }

  if (state !== 'granted') {
    throw new FileHandleAccessError('Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.');
  }
};

/**
 * StartIn type - kan være directory handle eller well-known directory
 */
type StartInOption = FileSystemDirectoryHandle | 'desktop' | 'documents' | 'downloads';

/**
 * Åbner fil via File System Access API
 * Viser rigtig File Explorer og returnerer fil + file handle
 *
 * @param startIn - Startplacering (directory handle eller well-known directory)
 */
export const openFileWithPicker = async (
  startIn: StartInOption = 'desktop'
): Promise<{ file: File; handle: FileSystemFileHandle } | null> => {
  let fileHandle: FileSystemFileHandle;
  try {
    const showOpenFilePicker = window.showOpenFilePicker;
    if (typeof showOpenFilePicker !== 'function') {
      throw new Error('File System Access API er ikke understøttet i denne browser');
    }

    [fileHandle] = await showOpenFilePicker({
      startIn,
      types: [
        {
          description: 'Mineo Erstatningsopgørelse',
          accept: {
            'application/x-eo': ['.eo'], // Custom MIME type kun for .eo
          },
        },
      ],
      multiple: false,
    });

  } catch (error: unknown) {
    const err = asError(error);
    if (getErrorName(error) === 'AbortError') {
      return null;
    }
    const accessError = toFileHandleAccessError(error, 'read');
    if (accessError) throw accessError;
    logError('Fejl ved fil-åbning:', err);
    throw new Error(`Kunne ikke åbne fil: ${err.message}`, { cause: error });
  }

  // Efter filvalget betyder AbortError en afbrudt læsning, ikke et annulleret filvalg.
  try {
    return { file: await getFileSnapshot(fileHandle, 'read'), handle: fileHandle };
  } catch (error: unknown) {
    const accessError = toFileHandleAccessError(error, 'read');
    if (accessError) throw accessError;
    const err = asError(error);
    logError('Fejl ved fil-åbning:', err);
    throw new Error(`Kunne ikke åbne fil: ${err.message}`, { cause: error });
  }
};

/**
 * Gemmer fil via File System Access API
 * Viser rigtig File Explorer til at vælge placering
 *
 * @param suggestedName - Foreslået filnavn
 * @param startIn - Startplacering (directory handle eller well-known directory)
 */
export const saveFileWithPicker = async (
  suggestedName: string,
  startIn: StartInOption = 'desktop'
): Promise<FileSystemFileHandle | null> => {
  try {
    // Sikr at filnavnet ender med .eo
    const finalName = suggestedName.endsWith('.eo') ? suggestedName : `${suggestedName}.eo`;

    const showSaveFilePicker = window.showSaveFilePicker;
    if (typeof showSaveFilePicker !== 'function') {
      throw new Error('File System Access API er ikke understøttet i denne browser');
    }

    const fileHandle = await showSaveFilePicker({
      suggestedName: finalName,
      startIn,
      types: [
        {
          description: 'Mineo Erstatningsopgørelse',
          accept: {
            'application/x-eo': ['.eo'], // Custom MIME type kun for .eo
          },
        },
      ],
    });

    // Valider at den valgte fil har .eo extension
    if (!fileHandle.name.toLowerCase().endsWith('.eo')) {
      logWarning(`Bruger valgte fil uden .eo extension: ${sanitizeFilenameForLog(fileHandle.name)}`);
      throw new Error('Filen skal have .eo extension');
    }

    return fileHandle;

  } catch (error: unknown) {
    const err = asError(error);
    if (getErrorName(error) === 'AbortError') {
      return null;
    }
    const accessError = toFileHandleAccessError(error, 'write');
    if (accessError) throw accessError;
    logError('Fejl ved fil-gemning:', err);
    throw new Error(`Kunne ikke vælge fil-placering: ${err.message}`, { cause: error });
  }
};

/**
 * Type guard: tjekker om en ukendt værdi er et FileSystemFileHandle.
 * Bruges til at validere handles hentet fra IndexedDB eller picker-kald.
 */
export const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.getFile === 'function';
};

/**
 * Skriver indhold til en fil via file handle
 */
export const writeToFileHandle = async (
  fileHandle: FileSystemFileHandle,
  content: string,
  expectedFingerprint?: string,
  isSourceStillCurrent?: () => boolean,
): Promise<void> => {
  let writable: FileSystemWritableFileStream | undefined;
  try {
    // Opret en writable stream
    const options = { mode: 'exclusive' as const, keepExistingData: false };
    let openExpired = false;
    const opening = fileHandle.createWritable(options).then(async (stream) => {
      // En forsinket stream må hverken skrive eller beholde låsen efter et afbrudt Gem.
      if (openExpired) await stream.abort();
      return stream;
    });
    writable = await withinFileIoDeadline(opening, 'write', () => { openExpired = true; });

    // Kontrollen i filvælgerforløbet er ikke nok: en anden gemning kan afsluttes,
    // mens denne stream åbnes. Kontrollér den accepterede revision under skrivelåsen.
    if (expectedFingerprint !== undefined && await readFileContentFingerprint(fileHandle) !== expectedFingerprint) {
      throw new FileSaveRevisionChangedError();
    }
    if (isSourceStillCurrent && !isSourceStillCurrent()) {
      throw new FileSaveSourceChangedError();
    }

    // Skriv indholdet
    await withinFileIoDeadline(writable.write(content), 'write');

    // Write ligger i en midlertidig fil indtil close. Et eksternt program kan have
    // ændret originalen imens, selv om browserens egen eksklusive lås er taget.
    if (expectedFingerprint !== undefined && await readFileContentFingerprint(fileHandle) !== expectedFingerprint) {
      throw new FileSaveRevisionChangedError();
    }

    // close erstatter filen. Revisionen kan have ændret sig under write eller indholdskontrollen.
    if (isSourceStillCurrent && !isSourceStillCurrent()) {
      throw new FileSaveSourceChangedError();
    }
    await writable.close();

  } catch (error: unknown) {
    // En fejlet skrivning må aldrig lukkes som et vellykket commit. Abort frigiver
    // midlertidige bytes og låse, så næste Gem kan forsøges uden en efterladt stream.
    if (writable) {
      try {
        await withinFileIoDeadline(writable.abort(), 'write');
      } catch {
        // Streamen kan allerede være fejlet/lukket. Bevar den oprindelige skrivefejl.
      }
    }
    const err = asError(error);
    const accessError = toFileHandleAccessError(error, 'write');
    if (accessError) throw accessError;
    logError('Fejl ved skrivning til fil:', err);
    throw new Error(`Kunne ikke skrive fil: ${err.message}`, { cause: error });
  }
};

/**
 * Læser indhold fra en fil via file handle
 */
export const readFromFileHandle = async (fileHandle: FileSystemFileHandle): Promise<string> => {
  try {
    const file = await getFileSnapshot(fileHandle, 'verify');
    if (file.size > MAX_FILE_SIZE) {
      throw new FileHandleAccessError('Filen er blevet for stor til at kunne kontrolleres sikkert. Filen er ikke bekræftet gemt.');
    }
    const bytes = await withinFileIoDeadline(file.arrayBuffer(), 'verify');
    // Read-back skal afsløre både ekstra BOM og ugyldige UTF-8-bytes.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);

  } catch (error: unknown) {
    const err = asError(error);
    if (toFileHandleAccessError(error, 'read')) {
      throw new FileHandleAccessError('Mineo kunne ikke læse filen tilbage efter skrivningen. Filen er ikke bekræftet gemt.', { cause: error });
    }
    logError('Fejl ved læsning fra fil:', err);
    throw new Error(`Kunne ikke læse fil: ${err.message}`, { cause: error });
  }
};
