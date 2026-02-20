/**
 * Zod schemas til Årsløn-siden
 *
 * Validerer input til beregninger før de køres.
 * Giver specifikke fejlbeskeder hvis data er ugyldig.
 *
 * @deprecated Brug schemas i `src/schemas/formSchemas.ts` som autoritativ kilde.
 */

import { z } from 'zod';

/**
 * Schema for en række i årsløn-tabellen (månedsperiode)
 */
export const AarsloenMaanedRowSchema = z.object({
  col0_maaned: z.string().optional(),
  col1_maaned: z.string().optional(),
  col2: z.union([z.string(), z.number()]).optional(),
  col3: z.union([z.string(), z.number()]).optional(),
  col4: z.union([z.string(), z.number()]).optional(),
  col5: z.union([z.string(), z.number()]).optional(),
  col0_uge: z.string().optional(),
  col1_uge: z.string().optional(),
  col0_dag: z.string().optional(),
  col1_dag: z.string().optional(),
});

/**
 * Schema for hele årsløn-tabellen
 */
export const AarsloenTableSchema = z.array(AarsloenMaanedRowSchema);

/**
 * Schema for årsløn-values
 */
export const AarsloenValuesSchema = z.object({
  feriePct: z.string(),
  fritvalgPct: z.string(),
  shSoPct: z.string(),
  storeBededagPct: z.string(),
  pensionPct: z.string(),
  loenperiode: z.enum(['maaned', 'uge', 'dag']),
  tableData: AarsloenTableSchema,
  omregningTilFuldtAar: z.boolean(),
  fuldLoenUnderFerie: z.boolean(),
  retTilSjetteFerieuge: z.boolean(),
  antalFeriedage: z.string(),
  loenPaaHelligdage: z.enum(['Almindelig løn', 'SH-udbetaling', 'Ingen']),
});

/**
 * Type-inference fra schema
 */
export type AarsloenMaanedRow = z.infer<typeof AarsloenMaanedRowSchema>;
export type AarsloenTableData = z.infer<typeof AarsloenTableSchema>;
export type AarsloenValues = z.infer<typeof AarsloenValuesSchema>;
