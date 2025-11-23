import { VERSION, FILE_FORMAT_VERSION } from '../config/version';
import { collectAllData, hasRealData, countFilledFields } from './dataCollection';
import { encryptToString } from './encryption';
import { generateFilename, downloadFile } from './fileHelpers';
import { logOperationStart, logOperationEnd, logDataStats, logInfo, logError, logWarning } from './logger';
import {
  isFileSystemAccessSupported,
  saveFileWithPicker,
  writeToFileHandle,
} from './fileSystemAccess';
import {
  requestPersistentStorage,
  saveFileHandleToIndexedDB,
  loadFileHandleFromIndexedDB,
  verifyFileHandle,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import { convertAarslonForFile } from './aarsloenDataConverter';

/**
 * Gemmer alle applikationsdata til krypteret .eo fil.
 *
 * Proces:
 * 1. Indsaml data fra sessionStorage
 * 2. Valider at der er data at gemme
 * 3. Tæl antal felter (til validering ved hent)
 * 4. Opbyg fil-struktur med metadata
 * 5. Krypter data
 * 6. Generer filnavn
 * 7. Download fil
 * 8. Gem filsti til sessionStorage (til hurtig overskrivning)
 *
 * @returns {Promise<Object>} Success-objekt med filnavn og statistik
 * @throws {Error} Hvis gemning fejler
 */
export const saveToFile = async () => {
  logOperationStart('Gem fil');

  try {
    // 1. Indsaml alle data fra sessionStorage
    logInfo('Indsamler data fra sessionStorage...');
    const allData = collectAllData();
    logDataStats(allData, 'Indsamlet data');

    // 1b. Konverter årsløn-data til fil-format (kun aktive kolonner)
    if (allData.aarslon) {
      logInfo('Konverterer årsløn-data til fil-format...');
      allData.aarslon = convertAarslonForFile(allData.aarslon);
      logInfo('✓ Årsløn-data konverteret');
    }

    // 2. Valider at vi har egentlige data at gemme
    if (!hasRealData(allData)) {
      const error = new Error('Ingen data fundet at gemme');
      logError('Validering fejlede:', error.message);
      throw error;
    }
    logInfo('✓ Data valideret - indeholder meningsfulde værdier');

    // 3. Tæl antal felter med data (KRITISK for validering ved hent!)
    const fieldCount = countFilledFields(allData);
    logInfo(`✓ Talt ${fieldCount} felter med data`);

    if (fieldCount === 0) {
      const error = new Error('Ingen udfyldte felter fundet');
      logError('Feltoptælling fejlede:', error.message);
      throw error;
    }

    // 4. Opbyg fil-struktur med metadata
    const fileData = {
      // Format version (til fremtidig kompatibilitet - bruger nu central konstant)
      version: FILE_FORMAT_VERSION,

      // Metadata
      _metadata: {
        exportDate: new Date().toISOString(),
        appVersion: VERSION,
        fieldCount: fieldCount, // VIGTIGT: Bruges til validering ved hent
      },

      // Selve data fra alle menupunkter
      data: allData,
    };

    logInfo('✓ Fil-struktur opbygget med metadata');

    // 5. Krypter data
    logInfo('Krypterer data...');
    const encrypted = encryptToString(fileData);
    logInfo(`✓ Data krypteret (${encrypted.length} bytes)`);

    // 6. Gem fil (File System Access API eller fallback)
    let filename;
    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {
      logInfo('Bruger File System Access API');

      // Anmod om persistent storage (kun første gang)
      await requestPersistentStorage();

      // Forsøg at hente tidligere gemt file handle fra IndexedDB
      let fileHandle = await loadFileHandleFromIndexedDB();
      const savedFilePath = sessionStorage.getItem('mineo_lastSavedFilePath');
      let shouldUseExistingHandle = false;

      if (fileHandle && savedFilePath) {
        // Vi har et gemt handle - valider det
        logInfo('Fundet gemt file handle - validerer...');

        // Tjek om stamdata matcher
        const currentFilename = generateFilename(fileData.data);
        const expectedFilename = `${currentFilename}.eo`;

        if (savedFilePath === expectedFilename) {
          // Stamdata matcher - forsøg at bruge gemt handle
          logInfo('✓ Filnavn matcher forventet (stamdata uændret)');

          // Valider at handle stadig virker
          const isValid = await verifyFileHandle(fileHandle);

          if (isValid) {
            // Handle er gyldigt - brug det direkte (browseren håndterer overskrivning)
            logInfo('✓ File handle er gyldigt - gemmer direkte');
            shouldUseExistingHandle = true;
          } else {
            // Handle er ugyldigt - slet fra IndexedDB og åbn file picker
            logWarning('File handle er ikke længere gyldigt - sletter fra IndexedDB');
            await deleteFileHandleFromIndexedDB();
            fileHandle = null;
          }
        } else {
          // Stamdata ændret - åbn file picker med nyt foreslået filnavn
          logWarning(`Filnavn matcher IKKE: forventet "${expectedFilename}", fandt "${savedFilePath}"`);
          logInfo('Stamdata er ændret - åbner file picker med nyt foreslået filnavn');
          fileHandle = null;
        }
      }

      // Hvis vi ikke skal bruge eksisterende handle, åbn file picker
      if (!shouldUseExistingHandle) {
        const currentFilename = generateFilename(fileData.data);
        const suggestedFilename = savedFilePath && !fileHandle
          ? savedFilePath
          : `${currentFilename}.eo`;

        logInfo(`Åbner file picker med forslag: ${suggestedFilename}`);
        fileHandle = await saveFileWithPicker(suggestedFilename);

        if (!fileHandle) {
          // Bruger annullerede - returner stille uden fejl
          logInfo('Bruger annullerede fil-valg');
          return { cancelled: true };
        }

        // Gem nyt handle til IndexedDB
        await saveFileHandleToIndexedDB(fileHandle);
      }

      // Skriv til fil
      logInfo('Skriver til fil via File System Access API...');
      await writeToFileHandle(fileHandle, encrypted);
      logInfo('✓ Fil gemt succesfuldt');

      filename = fileHandle.name;

      // Gem filnavn til sessionStorage (til validering ved næste gem)
      sessionStorage.setItem('mineo_lastSavedFilePath', filename);

    } else {
      // Fallback til klassisk download (Firefox, osv.)
      logWarning('File System Access API ikke tilgængelig - bruger fallback download');

      // Generer filnavn baseret på stamdata eller brug gemt navn
      const lastSavedPath = sessionStorage.getItem('mineo_lastSavedFilePath');
      const currentFilename = generateFilename(fileData.data);

      // Brug sidste gemte filnavn hvis stamdata er uændret, ellers brug nyt baseret på stamdata
      if (lastSavedPath && lastSavedPath.startsWith(currentFilename.split('_')[0])) {
        filename = lastSavedPath;
        logInfo(`Genbruger filnavn: ${filename}`);
      } else {
        filename = `${currentFilename}.eo`;
        logInfo(`Nyt filnavn genereret: ${filename}`);
      }

      // Download fil (browseren håndterer "filen eksisterer allerede" hvis relevant)
      logInfo('Downloader fil...');
      downloadFile(encrypted, filename, 'application/octet-stream');
      logInfo('✓ Fil downloadet');

      sessionStorage.setItem('mineo_lastSavedFilePath', filename);
    }

    logInfo('✓ Filsti gemt til sessionStorage');

    logOperationEnd('Gem fil', true);

    // Returner success-info
    return {
      success: true,
      filename: filename,
      fieldCount: fieldCount,
      sections: Object.keys(allData).length,
    };

  } catch (error) {
    logOperationEnd('Gem fil', false);

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = error.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    logError('Gem-operation fejlede:', safeErrorMessage);

    // Genkast med brugervenlig besked
    if (error.message.includes('Ingen data')) {
      throw error; // Bevar validerings-fejl som er
    }
    if (error.message.includes('Ingen udfyldte felter')) {
      throw error; // Bevar validerings-fejl som er
    }
    if (error.message.includes('annulleret')) {
      throw error; // Bevar annullerings-besked
    }

    throw new Error(`Kunne ikke gemme fil: ${error.message}`);
  }
};

/**
 * Nulstiller gemt filsti (bruges hvis bruger vil gemme som ny fil).
 */
export const resetSavedFilePath = () => {
  sessionStorage.removeItem('mineo_lastSavedFilePath');
  logInfo('Filsti nulstillet - næste gem vil prompte for nyt navn');
};
