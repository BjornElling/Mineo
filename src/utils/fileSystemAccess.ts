import { logWarning, logError, sanitizeFilenameForLog } from './logger';

/**
 * Tjekker om File System Access API er tilgængelig i browseren
 */
export const isFileSystemAccessSupported = (): boolean => {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
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
    if (!showOpenFilePicker) {
      throw new Error('File System Access API er ikke understøttet i denne browser');
    }

    const [fileHandle] = await showOpenFilePicker({
      startIn,
      types: [
        {
          description: 'MinEO Erstatningsopgørelse',
          accept: {
            'application/x-eo': ['.eo'], // Custom MIME type kun for .eo
          },
        },
      ],
      multiple: false,
    });

    const file = await fileHandle.getFile();

    return { file, handle: fileHandle };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null;
    }
    logError('Fejl ved fil-åbning:', error);
    throw new Error(`Kunne ikke åbne fil: ${error.message}`);
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
    if (!showSaveFilePicker) {
      throw new Error('File System Access API er ikke understøttet i denne browser');
    }

    const fileHandle = await showSaveFilePicker({
      suggestedName: finalName,
      startIn,
      types: [
        {
          description: 'MinEO Erstatningsopgørelse',
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

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null;
    }
    logError('Fejl ved fil-gemning:', error);
    throw new Error(`Kunne ikke vælge fil-placering: ${error.message}`);
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
export const writeToFileHandle = async (fileHandle: FileSystemFileHandle, content: string): Promise<void> => {
  try {
    // Opret en writable stream
    const writable = await fileHandle.createWritable();

    // Skriv indholdet
    await writable.write(content);

    // Luk filen
    await writable.close();

  } catch (error: any) {
    logError('Fejl ved skrivning til fil:', error);
    throw new Error(`Kunne ikke skrive fil: ${error.message}`);
  }
};

/**
 * Læser indhold fra en fil via file handle
 */
export const readFromFileHandle = async (fileHandle: FileSystemFileHandle): Promise<string> => {
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();

    return content;

  } catch (error: any) {
    logError('Fejl ved læsning fra fil:', error);
    throw new Error(`Kunne ikke læse fil: ${error.message}`);
  }
};
