/**
 * Data-validering for .eo-filer.
 * Beskytter mod malformed data der kan crashe UI'et.
 */

import type { ValidationResult, EoFileData } from '../types/common';
import { STORAGE_KEYS } from '../config/storageManifest';

// =============================================================================
// VALIDERINGS-KONSTANTER
// =============================================================================

// Maksimale string-længder (beskyt mod memory-problemer)
const MAX_STRING_LENGTH = 10000; // 10KB per felt
const MAX_ARRAY_LENGTH = 1000;   // Max antal elementer i arrays
const MAX_OBJECT_DEPTH = 10;     // Max nesting-niveau

// Tilladte sektioner i root-data.
// VIGTIGT: Dette SKAL være i sync med hvilke sider der persisterer data (usePersistedForm).
// Derfor afledes det direkte fra STORAGE_KEYS-manifestet for at undgå typos/manglende dækning.
const ALLOWED_SECTIONS: ReadonlyArray<string> = Object.keys(STORAGE_KEYS);

// =============================================================================
// VALIDERINGS-FUNKTIONER
// =============================================================================

/**
 * Validerer om en værdi er en gyldig dato i dd-mm-åååå format.
 */
const isValidDate = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;

  // Tillad tom string (ikke-udfyldt felt)
  if (value === '') return true;

  // Valider format: dd-mm-åååå
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  if (!datePattern.test(value)) return false;

  // Valider at dato er rigtig (fx ikke 32-13-2024)
  const [day, month, year] = value.split('-').map(Number);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Simpel måneds-validering (ikke perfekt, men godt nok)
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;

  return true;
};

/**
 * Validerer om en værdi er et gyldigt tal.
 */
const isValidNumber = (value: unknown): boolean => {
  if (typeof value === 'number') {
    // Afvis Infinity, -Infinity, NaN
    return isFinite(value);
  }

  if (typeof value === 'string') {
    // Tillad tom string (ikke-udfyldt felt)
    if (value === '') return true;

    // Tillad tal-strings
    const num = Number(value);
    return !isNaN(num) && isFinite(num);
  }

  return false;
};

/**
 * Validerer om en værdi er en gyldig string.
 */
const isValidString = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;

  // Tjek maksimal længde (beskyt mod memory-problemer)
  if (value.length > MAX_STRING_LENGTH) return false;

  return true;
};

/**
 * Validerer om en værdi er en gyldig boolean.
 */
const _isValidBoolean = (value: unknown): boolean => {
  return typeof value === 'boolean';
};

/**
 * Validerer objekt-dybde (beskyt mod stack overflow).
 */
const validateDepth = (obj: unknown, currentDepth: number = 0): boolean => {
  if (currentDepth > MAX_OBJECT_DEPTH) {
    return false;
  }

  if (obj === null || typeof obj !== 'object') {
    return true;
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_LENGTH) return false;

    for (const item of obj) {
      if (!validateDepth(item, currentDepth + 1)) {
        return false;
      }
    }
    return true;
  }

  // Objekt
  const keys = Object.keys(obj);
  if (keys.length > MAX_ARRAY_LENGTH) return false;

  for (const key of keys) {
    if (!validateDepth(obj[key], currentDepth + 1)) {
      return false;
    }
  }

  return true;
};

/**
 * Validerer en generisk sektion (stamdata, satser, renteberegning, osv.).
 * Tillader string, number, boolean, object og array.
 * Afviser kun farlige typer (function, symbol) og malformed data.
 */
const validateSection = (section: unknown, sectionName: string): ValidationResult => {
  const errors: string[] = [];

  // Tjek at sektion er et objekt
  if (typeof section !== 'object' || section === null) {
    errors.push(`${sectionName}: Sektion er ikke et objekt`);
    return { valid: false, errors };
  }

  // Tjek array (tilladt, men skal være top-level objekt, ikke array)
  if (Array.isArray(section)) {
    errors.push(`${sectionName}: Sektion må ikke være et array (skal være et objekt)`);
    return { valid: false, errors };
  }

  // Tjek dybde (beskyttelse mod stack overflow)
  if (!validateDepth(section)) {
    errors.push(`${sectionName}: For dyb nesting eller for mange elementer`);
    return { valid: false, errors };
  }

  // Valider alle felter i sektionen
  for (const [key, value] of Object.entries(section)) {
    // Skip null/undefined (repræsenterer tomme felter)
    if (value === null || value === undefined) {
      continue;
    }

    // Tjek type
    const valueType = typeof value;

    if (valueType === 'string') {
      if (!isValidString(value)) {
        errors.push(`${sectionName}.${key}: String for lang (max ${MAX_STRING_LENGTH} tegn)`);
      }
      // Tjek om det ligner en dato
      if (key.toLowerCase().includes('dato') && value !== '' && !isValidDate(value)) {
        errors.push(`${sectionName}.${key}: Ugyldig dato-format (skal være dd-mm-åååå eller tom)`);
      }
    } else if (valueType === 'number') {
      if (!isValidNumber(value)) {
        errors.push(`${sectionName}.${key}: Ugyldigt tal (Infinity/NaN ikke tilladt)`);
      }
    } else if (valueType === 'boolean') {
      // Boolean er OK
    } else if (valueType === 'object') {
      // Nested objekter og arrays er OK, men tjek dybde
      if (!validateDepth(value)) {
        errors.push(`${sectionName}.${key}: For dyb nesting eller for mange elementer`);
      }
    } else if (valueType === 'function' || valueType === 'symbol') {
      // Function og Symbol er IKKE tilladt (sikkerhedsrisiko)
      errors.push(`${sectionName}.${key}: Ulovlig type '${valueType}' (function/symbol ikke tilladt)`);
    }
    // Alle andre typer (bigint, osv.) tillades (permissiv tilgang)
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validerer årsløn-sektion (specialformat med tableData array og loenperiode).
 * Årsløn-data har en kompleks struktur, så vi tillader mere fleksibilitet.
 */
const validateAarsloen = (aarsloenData: unknown): ValidationResult => {
  const errors: string[] = [];

  // Tjek at det er et objekt
  if (typeof aarsloenData !== 'object' || aarsloenData === null) {
    errors.push('aarsloen: Sektion er ikke et objekt');
    return { valid: false, errors };
  }

  // Tjek array (tilladt i årsløn-sektion)
  if (Array.isArray(aarsloenData)) {
    errors.push('aarsloen: Sektion må ikke være et array (skal være et objekt)');
    return { valid: false, errors };
  }

  // Tjek dybde
  if (!validateDepth(aarsloenData)) {
    errors.push('aarsloen: For dyb nesting eller for mange elementer');
    return { valid: false, errors };
  }

  // Type cast til at kunne tilgå properties
  const data = aarsloenData as Record<string, unknown>;

  // Valider loenperiode hvis til stede
  if (data.loenperiode !== undefined && data.loenperiode !== null) {
    const validPeriods = ['maaned', 'uge', 'dag'];
    if (typeof data.loenperiode !== 'string' || !validPeriods.includes(data.loenperiode)) {
      errors.push('aarsloen.loenperiode: Ugyldig lønperiode (skal være "maaned", "uge" eller "dag")');
    }
  }

  // Valider tableData hvis til stede
  if (data.tableData !== undefined && data.tableData !== null) {
    if (!Array.isArray(data.tableData)) {
      errors.push('aarsloen.tableData: Skal være et array');
    } else {
      // Tjek array-størrelse
      if (data.tableData.length > MAX_ARRAY_LENGTH) {
        errors.push(`aarsloen.tableData: For mange elementer (max ${MAX_ARRAY_LENGTH})`);
      }

      // Valider hvert element i tableData (grundlæggende validering)
      for (let i = 0; i < Math.min(data.tableData.length, 10); i++) {
        const row = data.tableData[i];
        if (typeof row !== 'object' || row === null) {
          errors.push(`aarsloen.tableData[${i}]: Element er ikke et objekt`);
        }
      }
    }
  }

  // Alle andre felter i årsløn accepteres (vi er permissive her for at undgå breaking changes)

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validerer komplet data-struktur fra .eo-fil.
 * Dette er den primære valideringsfunktion der kaldes efter dekryptering.
 */
export const validateFileData = (data: unknown): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Tjek at data er et objekt
  if (typeof data !== 'object' || data === null) {
    errors.push('Data er ikke et objekt');
    return { valid: false, errors, warnings };
  }

  // 2. Tjek at det ikke er et array
  if (Array.isArray(data)) {
    errors.push('Data må ikke være et array');
    return { valid: false, errors, warnings };
  }

  // 3. Tjek global dybde
  if (!validateDepth(data)) {
    errors.push('Data-struktur er for dybt nested eller har for mange elementer');
    return { valid: false, errors, warnings };
  }

  // 4. Valider at data kun indeholder tilladte sektioner
  const dataSections = Object.keys(data);
  for (const section of dataSections) {
    if (!ALLOWED_SECTIONS.includes(section)) {
      warnings.push(`Ukendt sektion '${section}' ignoreres`);
    }
  }

  // 5. Valider hver sektion individuelt
  for (const section of ALLOWED_SECTIONS) {
    if (data[section] === undefined || data[section] === null) {
      continue; // Sektion ikke til stede - det er OK
    }

    // Specialhåndtering af årsløn
    if (section === 'aarsloen') {
      const result = validateAarsloen(data[section]);
      errors.push(...result.errors);
    } else {
      const result = validateSection(data[section], section);
      errors.push(...result.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Fjerner ukendte felter fra data-objekt (sanitization).
 * VIGTIGT: Dette muterer ikke original-objektet, men returnerer en ny kopi.
 */
export const sanitizeFileData = (data: Record<string, unknown>): Partial<EoFileData> => {
  const sanitized: Partial<EoFileData> = {};

  for (const section of ALLOWED_SECTIONS) {
    if (data[section] !== undefined && data[section] !== null) {
      (sanitized as Record<string, unknown>)[section] = data[section];
    }
  }

  return sanitized;
};
