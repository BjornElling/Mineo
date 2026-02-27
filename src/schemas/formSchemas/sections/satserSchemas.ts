import { z } from 'zod';
import { yearInteger } from '../baseSchemas';

export const satserSchema = z.object({
  aargang: yearInteger,
}).strict();

export type SatserValues = z.infer<typeof satserSchema>;
