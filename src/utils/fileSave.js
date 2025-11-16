import { VERSION } from '../config/version';
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
      // Format version (til fremtidig kompatibilitet)
      version: '1.0.0',

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
            // Handle er gyldigt - spørg om overskrivning
            const confirmOverwrite = window.confirm(
              `Vil du overskrive den eksisterende fil?\n\n${savedFilePath}\n\nKlik OK for at overskrive automatisk, eller Annuller for at vælge ny placering.`
            );

            if (confirmOverwrite) {
              logInfo('✓ Bruger bekræfter overskrivning - gemmer direkte uden file picker');
              shouldUseExistingHandle = true;
            } else {
              logInfo('Bruger vælger ny placering');
              fileHandle = null; // Nulstil så vi åbner file picker
            }
          } else {
            // Handle er ugyldigt - slet fra IndexedDB
            logWarning('File handle er ikke længere gyldigt - sletter fra IndexedDB');
            await deleteFileHandleFromIndexedDB();
            fileHandle = null;
          }
        } else {
          // Stamdata ændret - foreslå nyt filnavn
          logWarning(`Filnavn matcher IKKE: forventet "${expectedFilename}", fandt "${savedFilePath}"`);

          const useNewName = window.confirm(
            `Stamdata er ændret siden sidste gem.\n\nNyt foreslået filnavn: ${expectedFilename}\n\nKlik OK for at gemme med nyt navn, eller Annuller for at beholde det gamle navn (${savedFilePath}).`
          );

          if (useNewName) {
            // Nyt navn - åbn file picker
            logInfo('Bruger vælger nyt filnavn - åbner file picker');
            fileHandle = null;
          } else {
            // Behold gammelt navn - valider handle
            logInfo('Bruger beholder gammelt filnavn');

            const isValid = await verifyFileHandle(fileHandle);

            if (isValid) {
              shouldUseExistingHandle = true;
            } else {
              logWarning('File handle er ikke længere gyldigt - åbner file picker');
              await deleteFileHandleFromIndexedDB();
              fileHandle = null;
            }
          }
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

      const lastSavedPath = sessionStorage.getItem('mineo_lastSavedFilePath');

      if (lastSavedPath) {
        const confirmOverwrite = window.confirm(
          `Vil du overskrive den eksisterende fil?\n\n${lastSavedPath}\n\nKlik OK for at overskrive, eller Annuller for at gemme med nyt navn.`
        );

        if (confirmOverwrite) {
          filename = lastSavedPath;
          logInfo(`Genbruger filnavn: ${filename}`);
        } else {
          const baseName = generateFilename(fileData.data);
          const newName = prompt('Indtast filnavn (uden .eo):', baseName);

          if (!newName) {
            logInfo('Bruger annullerede fil-navngivning');
            throw new Error('Gem annulleret');
          }

          filename = `${newName.trim()}.eo`;
          logInfo(`Nyt filnavn valgt: ${filename}`);
        }
      } else {
        const baseName = generateFilename(fileData.data);
        const newName = prompt('Indtast filnavn (uden .eo):', baseName);

        if (!newName) {
          logInfo('Bruger annullerede fil-navngivning');
          throw new Error('Gem annulleret');
        }

        filename = `${newName.trim()}.eo`;
        logInfo(`Nyt filnavn valgt: ${filename}`);
      }

      // Download fil
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
    logError('Gem-operation fejlede:', error);

    // Genkast med brugervenlig besked
    if (error.message.includes('Ingen data')) {
      throw error; // Bevar validerings-fejl som er
    }
    if (error.message.includes('Ingen udfyldte felter')) {
      throw error; // Bevar validerings-fejl som er
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
