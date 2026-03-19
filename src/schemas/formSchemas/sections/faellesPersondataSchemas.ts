import { z } from 'zod';
import { optionalIsoDateString } from '../baseSchemas';

export const faellesPersondataSchema = z.object({
  skadelidteFodselsdato: optionalIsoDateString,
}).strict();

export type FaellesPersondataValues = z.infer<typeof faellesPersondataSchema>;
