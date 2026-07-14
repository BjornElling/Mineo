import { z } from 'zod';
import { amountValue } from '../baseSchemas';

export const faellesAarsloenSchema = z.object({
  aslAarsloen: amountValue,
  ealAarsloen: amountValue,
}).strict();

export type FaellesAarsloenValues = z.infer<typeof faellesAarsloenSchema>;
