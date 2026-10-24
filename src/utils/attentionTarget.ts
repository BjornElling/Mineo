import { z } from 'zod';
import { fieldAddressSchema } from '../inputCore/fieldAddress';
import { fieldAddressTemplateSchema } from '../inputCore/fieldDescriptor';

/** Fælles, valideret mål for en kortvarig opmærksomhedsmarkering. */
export const attentionTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fieldAddress'), address: fieldAddressSchema }).strict().readonly(),
  z.object({ kind: z.literal('collectionField'), template: fieldAddressTemplateSchema }).strict().readonly(),
  z.object({ kind: z.literal('rowId'), rowId: z.string().min(1) }).strict().readonly(),
]).readonly();

export type AttentionTarget = z.infer<typeof attentionTargetSchema>;
