import { z } from 'zod';
import { tableAmountCellValue } from '../baseSchemas';

export const faellesAarsloenSchema = z.object({
  aslAarsloen: tableAmountCellValue,
  ealAarsloen: tableAmountCellValue,
}).strict();

export type FaellesAarsloenValues = z.infer<typeof faellesAarsloenSchema>;
