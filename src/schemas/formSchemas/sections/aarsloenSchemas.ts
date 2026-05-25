import { z } from 'zod';
import {
  allowEmptyString,
  dayCount,
  percentageDecimal,
  tableAmountCellValue,
  tableIsoDateCellString,
} from '../baseSchemas';
import { loenPaaHelligdageEnum, loenperiodeEnum } from '../enumSchemas';

export const standardLoenTableRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  col0_maaned: allowEmptyString,
  col1_maaned: allowEmptyString,
  col0_uge: allowEmptyString,
  col1_uge: allowEmptyString,
  col0_dag: tableIsoDateCellString,
  col1_dag: tableIsoDateCellString,
  // col2 og col3 er to visuelt adskilte lønfelter med identisk domænebetydning.
  // Beregninger må ikke skelne mellem dem; de lægges blot sammen.
  col2: tableAmountCellValue,
  col3: tableAmountCellValue,
  col4: tableAmountCellValue,
  col5: tableAmountCellValue,
}).strict();

export type StandardLoenTableRow = z.infer<typeof standardLoenTableRowSchema>;

export const aarsloenSchema = z.object({
  feriePct: percentageDecimal,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeEnum,
  tableData: z.array(standardLoenTableRowSchema),
  omregningTilFuldtAar: z.boolean(),
  fuldLoenUnderFerie: z.boolean(),
  retTilSjetteFerieuge: z.boolean(),
  antalFeriedage: dayCount,
  loenPaaHelligdage: loenPaaHelligdageEnum,
}).strict();

export type AarsloenValues = z.infer<typeof aarsloenSchema>;
