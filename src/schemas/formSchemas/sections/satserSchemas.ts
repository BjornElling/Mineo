import { z } from 'zod';
import { wholeNumber } from '../baseSchemas';

// Kun det valgte satsår er sagsinput. Sats- og rentetabeller er programdata og må ikke gemmes i .eo.
export const satserSchema = z.object({
  aargang: wholeNumber,
}).strict();

export type SatserValues = z.infer<typeof satserSchema>;
