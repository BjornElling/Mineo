import { z } from 'zod';
import { positiveAmountValue } from '../baseSchemas';

export const faellesAarsloenSchema = z.object({
  aslAarsloen: positiveAmountValue,
  ealAarsloen: positiveAmountValue,
}).strict();

export type FaellesAarsloenValues = z.infer<typeof faellesAarsloenSchema>;
