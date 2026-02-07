/**
 * Zod schemas til Stamdata-siden
 *
 * Validerer stamdata input (datoer, CPR, navne, etc.)
 */

import { z } from 'zod';

/**
 * Dansk dato-format: dd-mm-åååå
 */
const danishDateRegex = /^\d{2}-\d{2}-\d{4}$/;

/**
 * Schema for dansk dato (dd-mm-åååå)
 */
export const DanishDateSchema = z
  .string()
  .regex(danishDateRegex, 'Datoen skal være i formatet dd-mm-åååå')
  .refine(
    (dateStr) => {
      // Tjek at dato er gyldig (ikke 32-01-2025 fx)
      const [day, month, year] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCFullYear(year);
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: 'Ugyldig dato' }
  );

/**
 * Schema for stamdata-values
 */
export const StamdataValuesSchema = z.object({
  skadesdato: DanishDateSchema.optional().or(z.literal('')),
  cprNummer: z.string().optional(),
  navn: z.string().optional(),
  adresse: z.string().optional(),
});

/**
 * Type-inference fra schema
 */
export type StamdataValues = z.infer<typeof StamdataValuesSchema>;
