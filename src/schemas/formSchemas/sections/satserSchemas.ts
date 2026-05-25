import { z } from 'zod';
import { yearInteger } from '../baseSchemas';

// Kun det valgte satsår er sagsinput. Sats- og rentetabeller er programdata og må ikke gemmes i .eo.
export const satserSchema = z.object({
  aargang: yearInteger,
}).strict();

export type SatserValues = z.infer<typeof satserSchema>;
