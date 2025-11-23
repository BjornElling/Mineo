import { logInfo, logWarning, logError } from './logger';

/**
 * Tjekker om File System Access API er tilgængelig i browseren
 *
 * @returns {boolean} True hvis API er tilgængelig
 */
export const isFileSystemAccessSupported = () => {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
};

/**
 * Åbner fil via File System Access API
 * Viser rigtig File Explorer og returnerer fil + file handle
 *
 * @returns {Promise<{file: File, handle: FileSystemFileHandle}>} Fil og handle
 */
export const openFileWithPicker = async () => {
  try {
    logInfo('Åbner File System Access API file picker...');

    const [fileHandle] = await window.showOpenFilePicker({
      startIn: 'desktop', // Foreslå skrivebord som start-placering
      types: [
        {
          description: 'MINEO Erstatningsopgørelse',
          accept: {
            'application/x-eo': ['.eo'], // Custom MIME type kun for .eo
          },
        },
      ],
      multiple: false,
    });

    const file = await fileHandle.getFile();

    logInfo(`Fil valgt: ${file.name}`);

    return { file, handle: fileHandle };

  } catch (error) {
    if (error.name === 'AbortError') {
      logInfo('Bruger annullerede fil-valg');
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
 * @param {string} suggestedName - Foreslået filnavn
 * @returns {Promise<FileSystemFileHandle>} File handle til den valgte fil
 */
export const saveFileWithPicker = async (suggestedName) => {
  try {
    logInfo(`Åbner File System Access API save picker med forslag: ${suggestedName}`);

    // Sikr at filnavnet ender med .eo
    const finalName = suggestedName.endsWith('.eo') ? suggestedName : `${suggestedName}.eo`;

    const fileHandle = await window.showSaveFilePicker({
      suggestedName: finalName,
      startIn: 'desktop', // Foreslå skrivebord som start-placering
      types: [
        {
          description: 'MINEO Erstatningsopgørelse',
          accept: {
            'application/x-eo': ['.eo'], // Custom MIME type kun for .eo
          },
        },
      ],
    });

    // Valider at den valgte fil har .eo extension
    if (!fileHandle.name.toLowerCase().endsWith('.eo')) {
      logWarning(`Bruger valgte fil uden .eo extension: ${fileHandle.name}`);
      throw new Error('Filen skal have .eo extension');
    }

    logInfo(`Fil-placering valgt: ${fileHandle.name}`);

    return fileHandle;

  } catch (error) {
    if (error.name === 'AbortError') {
      logInfo('Bruger annullerede fil-gemning');
      return null;
    }
    logError('Fejl ved fil-gemning:', error);
    throw new Error(`Kunne ikke vælge fil-placering: ${error.message}`);
  }
};

/**
 * Skriver indhold til en fil via file handle
 *
 * @param {FileSystemFileHandle} fileHandle - File handle til filen
 * @param {string} content - Indhold der skal skrives
 */
export const writeToFileHandle = async (fileHandle, content) => {
  try {
    logInfo(`Skriver til fil: ${fileHandle.name}`);

    // Opret en writable stream
    const writable = await fileHandle.createWritable();

    // Skriv indholdet
    await writable.write(content);

    // Luk filen
    await writable.close();

    logInfo('✓ Fil skrevet succesfuldt');

  } catch (error) {
    logError('Fejl ved skrivning til fil:', error);
    throw new Error(`Kunne ikke skrive fil: ${error.message}`);
  }
};

/**
 * Læser indhold fra en fil via file handle
 *
 * @param {FileSystemFileHandle} fileHandle - File handle til filen
 * @returns {Promise<string>} Fil-indhold
 */
export const readFromFileHandle = async (fileHandle) => {
  try {
    logInfo(`Læser fra fil: ${fileHandle.name}`);

    const file = await fileHandle.getFile();
    const content = await file.text();

    logInfo(`✓ Fil læst (${content.length} bytes)`);

    return content;

  } catch (error) {
    logError('Fejl ved læsning fra fil:', error);
    throw new Error(`Kunne ikke læse fil: ${error.message}`);
  }
};
