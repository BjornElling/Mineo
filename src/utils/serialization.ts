/**
 * Serialization/deserialization layer for form persistence
 *
 * Håndterer konvertering mellem:
 * - Runtime types (number, Date, boolean)
 * - Storage types (JSON-serializable strings)
 *
 * Baseret på Zod schemas for type-sikkerhed.
 */

import { z } from 'zod';
import type { ISODateString } from '../types/branded';
import { coerceToISODateString } from '../types/branded';

// =============================================================================
// SERIALIZATION - Runtime → Storage
// =============================================================================

/**
 * Serialiserer form values til JSON-kompatibelt format
 *
 * Konverteringer:
 * - number → number (JSON understøtter numbers)
 * - boolean → boolean (JSON understøtter booleans)
 * - ISODateString → string (allerede string)
 * - undefined → null (JSON understøtter ikke undefined)
 * - Arrays/objects → rekursiv serialisering
 *
 * @param values - Form values med runtime types
 * @returns JSON-serializable object
 */
export function serializeFormValues<T extends Record<string, unknown>>(
  values: T
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    serialized[key] = serializeValue(value);
  }

  return serialized;
}

/**
 * Serialiserer en enkelt værdi
 */
function serializeValue(value: unknown): unknown {
  // undefined → null (JSON-kompatibelt)
  if (value === undefined) {
    return null;
  }

  // null, string, number, boolean → direkte
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  // Array → rekursiv serialisering
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  // Object → rekursiv serialisering
  if (typeof value === 'object' && value !== null) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = serializeValue(v);
    }
    return obj;
  }

  // Fallback: Konverter til string
  return String(value);
}

// =============================================================================
// DESERIALIZATION - Storage → Runtime
// =============================================================================

/**
 * Konverterer null til undefined i et objekt (rekursivt)
 *
 * Zod optional felter forventer undefined, ikke null.
 * JSON serialization konverterer undefined → null, så vi skal konvertere tilbage.
 */
function nullToUndefined(obj: unknown): unknown {
  if (obj === null) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map(nullToUndefined);
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = nullToUndefined(value);
    }
    return result;
  }

  return obj;
}

/**
 * Deserialiserer JSON data til type-safe form values
 *
 * Bruger Zod schema til:
 * - Runtime validering
 * - Type coercion (string → number)
 * - Default values ved fejl
 *
 * @param schema - Zod schema for form values
 * @param stored - JSON data fra storage
 * @param defaults - Default values (fallback ved parse-fejl)
 * @returns Type-safe form values
 */
export function deserializeFormValues<T extends Record<string, unknown>>(
  schema: z.ZodType<T>,
  stored: unknown,
  defaults: T
): T {
  // Hvis stored er null/undefined, brug defaults
  if (!stored || typeof stored !== 'object') {
    console.log('[Deserialization] Stored er null/undefined - bruger defaults');
    return defaults;
  }

  try {
    // DEBUG: Log raw stored data
    console.group('[Deserialization] Processing data');
    console.log('1. Raw stored data:', JSON.stringify(stored, null, 2));

    // Pre-process: Konverter null → undefined (Zod optional felter forventer undefined)
    const preprocessed = nullToUndefined(stored);
    console.log('2. Efter nullToUndefined:', JSON.stringify(preprocessed, null, 2));

    // Zod parser med coercion (string → number, etc.)
    const parsed = schema.parse(preprocessed);
    console.log('3. ✓ Zod parse SUCCESS');
    console.groupEnd();

    return parsed;
  } catch (error) {
    // Parse fejl → log detaljeret info og brug defaults
    console.error('[Deserialization] ❌ Zod parse FAILED');

    if (error instanceof z.ZodError) {
      console.error('Zod validation errors:');
      error.issues.forEach((issue, index) => {
        console.error(`  ${index + 1}. Path: ${issue.path.join('.')}`);
        console.error(`     Message: ${issue.message}`);
        console.error(`     Code: ${issue.code}`);
        if ('expected' in issue) console.error(`     Expected: ${issue.expected}`);
        if ('received' in issue) console.error(`     Received: ${issue.received}`);
      });
    } else {
      console.error('Non-Zod error:', error);
    }

    console.groupEnd();
    console.warn('Bruger defaults pga. parse-fejl');

    return defaults;
  }
}

// =============================================================================
// TYPE COERCION - Hjælpefunktioner
// =============================================================================

/**
 * Konverterer værdi til number (defensivt)
 *
 * @param value - Input værdi (string | number | undefined | null)
 * @returns number eller undefined
 */
export function coerceToNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? undefined : value;
  }

  if (typeof value === 'string') {
    // Fjern tusindtalsseparator (dansk format: "1.234,56")
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  return undefined;
}

/**
 * Konverterer værdi til integer (defensivt)
 *
 * @param value - Input værdi
 * @returns integer eller undefined
 */
export function coerceToInteger(value: unknown): number | undefined {
  const num = coerceToNumber(value);
  return num !== undefined ? Math.round(num) : undefined;
}

/**
 * Konverterer værdi til boolean (defensivt)
 *
 * @param value - Input værdi
 * @returns boolean
 */
export function coerceToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return false;
}

/**
 * Konverterer værdi til ISODateString (defensivt)
 *
 * Accepterer:
 * - ISO-format: "2024-12-15"
 * - Dansk format: "15-12-2024"
 *
 * @param value - Input værdi
 * @returns ISODateString eller undefined
 */
export function coerceToISODate(value: unknown): ISODateString | undefined {
  return coerceToISODateString(value);

}

// =============================================================================
// ZLIB PREPROCESSING - Før Zod parsing
// =============================================================================

/**
 * Pre-processor for stored data FØR Zod parsing
 *
 * Konverterer værdier som Zod ikke selv kan håndtere:
 * - null → undefined (for optional felter)
 * - Dansk datoformat → ISO
 * - String numbers → tal
 *
 * @param stored - Rå data fra storage
 * @param schema - Zod schema (bruges til at identificere felt-typer)
 * @returns Pre-processeret data klar til Zod parsing
 */
export function preprocessStoredData(
  stored: Record<string, unknown>,
  fieldTypes: Record<string, 'number' | 'integer' | 'boolean' | 'date' | 'string'>
): Record<string, unknown> {
  const processed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(stored)) {
    const fieldType = fieldTypes[key];

    if (!fieldType) {
      // Ukendt felt → behold som er
      processed[key] = value;
      continue;
    }

    // null → undefined (for optional felter)
    if (value === null) {
      processed[key] = undefined;
      continue;
    }

    // Type-specifik coercion
    switch (fieldType) {
      case 'number':
        processed[key] = coerceToNumber(value);
        break;
      case 'integer':
        processed[key] = coerceToInteger(value);
        break;
      case 'boolean':
        processed[key] = coerceToBoolean(value);
        break;
      case 'date':
        processed[key] = coerceToISODate(value);
        break;
      default:
        processed[key] = value;
    }
  }

  return processed;
}

// =============================================================================
// SCHEMA METADATA EXTRACTION
// =============================================================================

/**
 * Udtræk felt-type metadata fra Zod schema
 *
 * Dette bruges til at guide pre-processing af stored data.
 *
 * BEMÆRK: Dette er en simpel implementation - kan udvides ved behov.
 *
 * @param schema - Zod schema
 * @returns Map af felt-navn → type
 */
export function extractFieldTypes(
  _schema: z.ZodType
): Record<string, 'number' | 'integer' | 'boolean' | 'date' | 'string'> {
  // Dette er en placeholder - Zod har ikke built-in introspection
  // I praksis skal vi vedligeholde denne mapping manuelt pr. schema
  return {};
}

// =============================================================================
// ARRAY HANDLING - Special case for tabeller
// =============================================================================

/**
 * Deserialiserer array af rows (fx årsløn-tabel)
 *
 * @param schema - Zod schema for array items
 * @param stored - Stored array data
 * @returns Type-safe array
 */
export function deserializeArray<T>(
  schema: z.ZodType<T>,
  stored: unknown
): T[] {
  if (!Array.isArray(stored)) {
    return [];
  }

  const result: T[] = [];
  for (const item of stored) {
    try {
      const parsed = schema.parse(item);
      result.push(parsed);
    } catch (error) {
      // Skip invalid rows
      console.warn('Skipping invalid row:', error);
    }
  }

  return result;
}
