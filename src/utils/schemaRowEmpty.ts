/**
 * Fælles hjælpefunktioner til "tom række"-logik baseret på Zod-schemas.
 *
 * Disse funktioner bruges på tværs af domæner (erstatningsopgoerelse, renteberegning)
 * og bør IKKE placeres i et domæne-specifikt modul for at undgå krydsdomæne-afhængigheder.
 */

import type { ZodObject, ZodRawShape } from 'zod';

/**
 * Returnerer alle ikke-id-nøgler fra et Zod-objektschemas shape.
 */
export const nonIdKeysFromSchema = <T extends ZodRawShape>(schema: ZodObject<T>): readonly (Exclude<keyof T, 'id'> & string)[] => {
  return Object.keys(schema.shape).filter((k): k is Exclude<keyof T, 'id'> & string => k !== 'id');
};

/**
 * Returnerer true hvis alle specificerede nøgler i rækken er `undefined`.
 */
export const isEmptyByKeys = <T extends Record<string, unknown>>(row: T, keys: readonly (keyof T)[]): boolean => {
  for (const key of keys) {
    if (row[key] !== undefined) return false;
  }
  return true;
};
