import { clearAllData, saveDataToSessionStorage, countFilledFields, collectAllData, hasRealData } from './dataCollection';
import { decryptFromString } from './encryption';
import { selectFile, readFile } from './fileHelpers';
import { logOperationStart, logOperationEnd, logDataStats, logInfo, logWarning, logError } from './logger';
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
} from './fileSystemAccess';
import {
  saveFileHandleToIndexedDB,
} from './fileHandleStorage';

/**
 * Indlæser data fra krypteret .eo fil.
 *
 * Proces:
 * 1. Åbn fil-vælger dialog
 * 2. Læs fil
 * 3. Dekrypter og valider
 * 4. TØM ALLE eksisterende felter (kritisk!)
 * 5. Indlæs nye data til sessionStorage
 * 6. Tæl felter og valider mod forventet antal
 * 7. Reload side for at opdatere UI
 * 8. Gem filsti til sessionStorage
 *
 * @returns {Promise<Object>} Success-objekt med statistik og eventuelle advarsler
 * @throws {Error} Hvis indlæsning fejler
 */
export const loadFromFile = async () => {
  logOperationStart('Hent fil');

  try {
    // 1. Åbn fil-vælger dialog (File System Access API eller fallback)
    let file;
    let fileHandle = null;
    let fileContent;

    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {
      logInfo('Bruger File System Access API');

      // Åbn fil med File System Access API
      const result = await openFileWithPicker();

      if (!result) {
        logInfo('Bruger annullerede fil-valg');
        return { cancelled: true };
      }

      file = result.file;
      fileHandle = result.handle;

      logInfo(`Fil valgt: ${file.name}`);

      // Valider fil-extension
      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      // Læs fil via file handle
      logInfo('Læser fil via File System Access API...');
      fileContent = await readFromFileHandle(fileHandle);
      logInfo(`✓ Fil læst (${fileContent.length} bytes)`);

    } else {
      // Fallback til klassisk file picker
      logWarning('File System Access API ikke tilgængelig - bruger fallback file picker');

      logInfo('Åbner fil-vælger...');
      file = await selectFile('.eo');

      if (!file) {
        logInfo('Bruger annullerede fil-valg');
        return { cancelled: true };
      }

      logInfo(`Fil valgt: ${file.name}`);

      // Valider fil-extension
      if (!file.name.toLowerCase().endsWith('.eo')) {
        throw new Error('Valgt fil er ikke en .eo fil');
      }

      // Læs fil
      logInfo('Læser fil...');
      fileContent = await readFile(file);
      logInfo(`✓ Fil læst (${fileContent.length} bytes)`);
    }

    // 3. Dekrypter og valider
    logInfo('Dekrypterer data...');
    let decrypted;
    try {
      decrypted = decryptFromString(fileContent);
    } catch (error) {
      logError('Dekryptering fejlede:', error);
      throw new Error(`Kunne ikke dekryptere fil: ${error.message}`);
    }
    logInfo('✓ Data dekrypteret og valideret (checksum OK)');

    // Valider fil-struktur
    if (!decrypted.data) {
      throw new Error("Ugyldig fil-struktur (mangler 'data' sektion)");
    }

    // VIGTIGT: Tjek om der allerede er data i programmet
    // Hvis ja, advar brugeren før vi overskriver
    const existingData = collectAllData();
    const hasExistingData = hasRealData(existingData);

    if (hasExistingData) {
      const confirmOverwrite = window.confirm(
        'ADVARSEL: Dette vil overskrive alle indtastede oplysninger!\n\nEr du sikker på at du vil fortsætte?'
      );

      if (!confirmOverwrite) {
        logInfo('Bruger annullerede indlæsning - vil ikke overskrive eksisterende data');
        return { cancelled: true };
      }

      logInfo('Bruger bekræftede overskrivning af eksisterende data');
    }

    // Tjek version
    const fileVersion = decrypted.version || 'ukendt';
    logInfo(`Fil version: ${fileVersion}`);

    if (fileVersion !== '1.0.0') {
      logWarning(`⚠ Version mismatch: forventet 1.0.0, fandt ${fileVersion}`);
      // Fortsæt alligevel, men log advarsel
    }

    // Hent forventet field count fra metadata
    const expectedFieldCount = decrypted._metadata?.fieldCount;
    logInfo(`Forventet antal felter: ${expectedFieldCount || 'ikke angivet'}`);

    logDataStats(decrypted.data, 'Dekrypteret data');

    // 4. TØM ALLE eksisterende felter (KRITISK!)
    logInfo('Rydder alle eksisterende data fra sessionStorage...');
    clearAllData();
    logInfo('✓ Alle eksisterende data ryddet');

    // 5. Indlæs nye data til sessionStorage
    logInfo('Indlæser nye data til sessionStorage...');
    saveDataToSessionStorage(decrypted.data);
    logInfo('✓ Data indlæst til sessionStorage');

    // 6. Tæl felter efter indlæsning og valider (KRITISK FEJLSIKRING!)
    logInfo('Tæller felter efter indlæsning...');
    const actualFieldCount = countFilledFields(decrypted.data);
    logInfo(`Faktisk antal felter indlæst: ${actualFieldCount}`);

    // Valider field count
    let fieldCountWarning = null;
    if (expectedFieldCount !== undefined && actualFieldCount !== expectedFieldCount) {
      const diff = actualFieldCount - expectedFieldCount;
      const diffText = diff > 0 ? `+${diff}` : `${diff}`;

      fieldCountWarning = {
        message: `ADVARSEL: Antal felter matcher ikke!`,
        expected: expectedFieldCount,
        actual: actualFieldCount,
        difference: diff,
      };

      logWarning('⚠⚠⚠ KRITISK ADVARSEL ⚠⚠⚠');
      logWarning(`Forventet: ${expectedFieldCount} felter`);
      logWarning(`Faktisk:  ${actualFieldCount} felter`);
      logWarning(`Forskel:  ${diffText} felter`);
      logWarning('⚠⚠⚠ SLUT ADVARSEL ⚠⚠⚠');
    } else if (expectedFieldCount !== undefined) {
      logInfo(`✓ Field count valideret: ${actualFieldCount} felter (matcher forventet)`);
    }

    // 7. Gem filsti og handle til sessionStorage og IndexedDB
    sessionStorage.setItem('mineo_lastSavedFilePath', file.name);

    if (fileHandle) {
      // Gem file handle til IndexedDB (kun hvis File System Access API bruges)
      await saveFileHandleToIndexedDB(fileHandle);
      logInfo('✓ File handle gemt til IndexedDB');
    }

    logInfo('✓ Filsti gemt til sessionStorage');

    logOperationEnd('Hent fil', true);

    // Returner success-info (side reloades af caller)
    return {
      success: true,
      filename: file.name,
      fieldCount: actualFieldCount,
      expectedFieldCount: expectedFieldCount,
      sections: Object.keys(decrypted.data).length,
      fieldCountWarning: fieldCountWarning,
      version: fileVersion,
    };

  } catch (error) {
    logOperationEnd('Hent fil', false);
    logError('Hent-operation fejlede:', error);

    // Genkast med brugervenlig besked
    if (error.message.includes('annullerede')) {
      throw error; // Bevar annullerings-besked
    }
    if (error.message.includes('ikke en .eo fil')) {
      throw error; // Bevar extension-fejl
    }
    if (error.message.includes('dekryptere')) {
      throw error; // Bevar dekrypterings-fejl
    }

    throw new Error(`Kunne ikke indlæse fil: ${error.message}`);
  }
};

/**
 * Validerer om en fil er en gyldig .eo fil uden at indlæse den.
 *
 * @param {File} file - Fil der skal valideres
 * @returns {Promise<boolean>} True hvis gyldig, false ellers
 */
export const validateEoFile = async (file) => {
  try {
    if (!file.name.toLowerCase().endsWith('.eo')) {
      return false;
    }

    const content = await readFile(file);
    const parsed = JSON.parse(content);

    // Tjek basis-struktur
    return !!(parsed.data && parsed.checksum && parsed.version);

  } catch (error) {
    logError('Fil-validering fejlede:', error);
    return false;
  }
};
