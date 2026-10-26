import { logWarning, logError, sanitizeFilenameForLog } from './logger';
import { asError, getErrorName } from './typeGuards';
import { readFileContentFingerprint } from './fileContentFingerprint';
import { MAX_FILE_SIZE } from '../config/version';

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
        AbortError: 'Indlæsningen blev afbrudt. Ingen data blev indlæst. Prøv Hent igen.',
      }
    : {
        NotFoundError: 'Filen eller mappen blev ikke fundet – den er måske flyttet eller slettet. Prøv Gem igen, og vælg filplacering igen.',
        NotAllowedError: 'Mineo har ikke længere adgang til at gemme filen. Prøv Gem igen, og vælg en filplacering med skriveadgang.',
        SecurityError: 'Browseren tillader ikke at gemme filen her. Prøv Gem igen, og vælg filplacering igen.',
        NoModificationAllowedError: 'Filen kan ikke overskrives lige nu – den kan være skrivebeskyttet eller i brug af et andet program. Luk eventuelt filen dér, og prøv Gem igen.',
        NotReadableError: 'Filen kunne ikke kontrolleres – den kan være ændret eller i brug af et andet program. Prøv Gem igen.',
        QuotaExceededError: 'Der er ikke plads til at gemme filen. Frigør plads, eller prøv Gem igen med en anden filplacering.',
        AbortError: 'Skrivningen til filen blev afbrudt. Filen er ikke bekræftet gemt. Prøv Gem igen.',
      };
  const message = messages[name];
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

  let state = await handle.queryPermission({ mode: 'read' });
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
  try {
    const showOpenFilePicker = window.showOpenFilePicker;
    if (typeof showOpenFilePicker !== 'function') {
      throw new Error('File System Access API er ikke understøttet i denne browser');
    }

    const [fileHandle] = await showOpenFilePicker({
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

    const file = await fileHandle.getFile();

    return { file, handle: fileHandle };

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
    writable = await fileHandle.createWritable(options);

    // Kontrollen i filvælgerforløbet er ikke nok: en anden gemning kan afsluttes,
    // mens denne stream åbnes. Kontrollér den accepterede revision under skrivelåsen.
    if (expectedFingerprint !== undefined && await readFileContentFingerprint(fileHandle) !== expectedFingerprint) {
      throw new FileHandleAccessError('Filen blev ændret igen, mens gemningen var i gang. Intet blev skrevet. Prøv Gem igen.');
    }
    if (isSourceStillCurrent && !isSourceStillCurrent()) {
      throw new FileHandleAccessError('Gem blev afbrudt, fordi sagen blev ændret undervejs. Prøv at gemme igen.');
    }

    // Skriv indholdet
    await writable.write(content);

    // Write ligger i en midlertidig fil indtil close. Et eksternt program kan have
    // ændret originalen imens, selv om browserens egen eksklusive lås er taget.
    if (expectedFingerprint !== undefined && await readFileContentFingerprint(fileHandle) !== expectedFingerprint) {
      throw new FileHandleAccessError('Filen blev ændret igen, mens gemningen var i gang. Intet blev skrevet. Prøv Gem igen.');
    }

    // Luk filen
    await writable.close();

  } catch (error: unknown) {
    // En fejlet skrivning må aldrig lukkes som et vellykket commit. Abort frigiver
    // midlertidige bytes og låse, så næste Gem kan forsøges uden en efterladt stream.
    if (writable) {
      try {
        await writable.abort();
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
    const file = await fileHandle.getFile();
    if (file.size > MAX_FILE_SIZE) {
      throw new FileHandleAccessError('Filen er blevet for stor til at kunne kontrolleres sikkert. Filen er ikke bekræftet gemt.');
    }
    const content = await file.text();

    return content;

  } catch (error: unknown) {
    const err = asError(error);
    const accessError = toFileHandleAccessError(error, 'read');
    if (accessError) throw accessError;
    logError('Fejl ved læsning fra fil:', err);
    throw new Error(`Kunne ikke læse fil: ${err.message}`, { cause: error });
  }
};
