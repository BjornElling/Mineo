import { z } from 'zod';
import {
  allowEmptyString,
  dayCount,
  percentageDecimal,
  tableAmountCellValue,
} from '../baseSchemas';
import { loenPaaHelligdageSchema, loenperiodeSchema } from '../enumSchemas';

export const aarsloenTableRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  col0_maaned: allowEmptyString,
  col1_maaned: allowEmptyString,
  col0_uge: allowEmptyString,
  col1_uge: allowEmptyString,
  col0_dag: allowEmptyString,
  col1_dag: allowEmptyString,
  col2: tableAmountCellValue,
  col3: tableAmountCellValue,
  col4: tableAmountCellValue,
  col5: tableAmountCellValue,
}).strict();

export type AarsloenTableRow = z.infer<typeof aarsloenTableRowSchema>;

export const aarsloenSchema = z.object({
  feriePct: percentageDecimal,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeSchema,
  tableData: z.array(aarsloenTableRowSchema),
  omregningTilFuldtAar: z.boolean(),
  fuldLoenUnderFerie: z.boolean(),
  retTilSjetteFerieuge: z.boolean(),
  antalFeriedage: dayCount,
  loenPaaHelligdage: loenPaaHelligdageSchema,
}).strict();

export type AarsloenValues = z.infer<typeof aarsloenSchema>;
