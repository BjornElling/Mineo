import { clearAllData, saveDataToSessionStorage, countFilledFields, collectAllData } from './dataCollection';
import { decryptFromString } from './encryption';
import { selectFile, readFile } from './fileHelpers';
import { logOperationStart, logOperationEnd, logDataStats, logInfo, logWarning, logError } from './logger';
import { FILE_FORMAT_VERSION, MAX_FILE_SIZE } from '../config/version';
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
} from './fileSystemAccess';
import {
  saveFileHandleToIndexedDB,
} from './fileHandleStorage';
import { convertAarslonFromFile } from './aarsloenDataConverter';

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

      // Valider filstørrelse (sikkerhedstjek)
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
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

      // Valider filstørrelse (sikkerhedstjek)
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw new Error(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
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

    // Valider grundlæggende fil-struktur
    if (!decrypted.data) {
      throw new Error("Ugyldig fil-struktur (mangler 'data' sektion)");
    }

    if (typeof decrypted.data !== 'object' || decrypted.data === null) {
      throw new Error("Ugyldig fil-struktur ('data' sektion er ikke et objekt)");
    }

    // Valider at data-sektionen indeholder de forventede sektioner
    const expectedSections = [
      'stamdata',
      'skadeserstatning',
      'erhvervsevnetab',
      'fremtidigeUdgifter',
      'aegtefaelle',
      'forsørgertab',
      'tortgodtgørelse'
    ];

    const dataSections = Object.keys(decrypted.data);
    const hasValidSections = expectedSections.some(section => dataSections.includes(section));

    if (!hasValidSections) {
      throw new Error('Ugyldig fil-struktur (mangler forventede data-sektioner)');
    }

    // Valider at hver sektion er et objekt
    for (const section of dataSections) {
      if (typeof decrypted.data[section] !== 'object' || decrypted.data[section] === null) {
        throw new Error(`Ugyldig data-struktur i sektion '${section}' (ikke et objekt)`);
      }
    }

    // VIGTIGT: Tjek om der allerede er data i programmet
    // Hvis ja, advar brugeren før vi overskriver
    const existingData = collectAllData();
    const hasExistingData = countFilledFields(existingData) > 0;

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

    // Tjek version (bruger nu central konstant)
    const fileVersion = decrypted.version || 'ukendt';
    logInfo(`Fil version: ${fileVersion}`);

    if (fileVersion !== FILE_FORMAT_VERSION) {
      logWarning(`⚠ Version mismatch: forventet ${FILE_FORMAT_VERSION}, fandt ${fileVersion}`);
      // Fortsæt alligevel, men log advarsel
    }

    // Hent forventet field count fra metadata
    const expectedFieldCount = decrypted._metadata?.fieldCount;
    logInfo(`Forventet antal felter: ${expectedFieldCount || 'ikke angivet'}`);

    logDataStats(decrypted.data, 'Dekrypteret data');

    // 3b. Konverter årsløn-data fra fil-format til internt format
    if (decrypted.data.aarslon) {
      logInfo('Konverterer årsløn-data fra fil-format...');
      decrypted.data.aarslon = convertAarslonFromFile(decrypted.data.aarslon);
      logInfo('✓ Årsløn-data konverteret');
    }

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

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = error.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    logError('Hent-operation fejlede:', safeErrorMessage);

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
    if (error.message.includes('for stor')) {
      throw error; // Bevar filstørrelses-fejl
    }
    if (error.message.includes('Ugyldig fil-struktur')) {
      throw error; // Bevar struktur-fejl
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
