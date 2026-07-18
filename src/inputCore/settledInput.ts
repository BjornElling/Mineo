import { z } from 'zod';
import { persistenceSchemas } from '../config/persistenceRegistry';
import type { FieldRejectReason, FieldRejectDetail } from './fieldCodec';
import { serializedFieldAddressSchema } from './fieldAddress';

// Greenfield-kerne (§3.1): den autoritative inputtilstand bevarer de eksisterende Zod-validerede
// sektionsformer. `rejectedInputs` er IKKE en maske over en recovery-værdi — det er den rå del af et
// aktuelt fejlende felt, hvis canonical slot samtidig er feltets tomværdi (XOR, håndhævet af kataloget).

const nullableSectionSchemas = Object.fromEntries(
  Object.entries(persistenceSchemas).map(([section, schema]) => [section, schema.nullable()])
) as { [K in keyof typeof persistenceSchemas]: z.ZodNullable<(typeof persistenceSchemas)[K]> };

export const persistedInputSectionsSchema = z.object(nullableSectionSchemas).strict().readonly();

export type PersistedInputSections = z.infer<typeof persistedInputSectionsSchema>;

// Efter kravændringen 2026-07-18 er `format` den eneste afvisningsårsag: schema-repræsenterbare out-of-bounds-
// værdier committes canonical med et afledt bounds-issue (§1.6), ikke som rejected råtekst.
const rejectReasonSchema = z.enum(['format']);

/**
 * Et fejlende felts rå tekst plus den maskinlæsbare årsag/detalje, som codecet allerede afgjorde.
 * Årsagen persisteres, så issue-/tooltipteksten kan bygges uden at reparse råteksten (§1.8).
 */
export const rejectedInputSchema = z.object({
  raw: z.string().refine((value) => value.trim() !== '', 'Rejected input må ikke være tomt'),
  reason: rejectReasonSchema,
  detail: z.record(z.string().min(1), z.union([z.string(), z.number().finite(), z.boolean()]))
    .optional(),
}).strict().readonly();

export type RejectedInput = z.infer<typeof rejectedInputSchema> & Readonly<{
  reason: FieldRejectReason;
  detail?: FieldRejectDetail;
}>;

export const rejectedInputsSchema = z.record(serializedFieldAddressSchema, rejectedInputSchema).readonly();

export type RejectedInputs = z.output<typeof rejectedInputsSchema>;

/** Strukturelt basisskema. Katalog-afhængig XOR-/eksistens-validering ligger på `InputCatalog`. */
export const settledInputBaseSchema = z.object({
  sections: persistedInputSectionsSchema,
  rejectedInputs: rejectedInputsSchema,
}).strict().readonly();

export type SettledInputCandidate = z.input<typeof settledInputBaseSchema>;
export type SettledInput = z.output<typeof settledInputBaseSchema>;

export const createEmptyPersistedInputSections = (): PersistedInputSections =>
  persistedInputSectionsSchema.parse(
    Object.fromEntries(Object.keys(persistenceSchemas).map((section) => [section, null]))
  );

export const createEmptySettledInput = (): SettledInput => settledInputBaseSchema.parse({
  sections: createEmptyPersistedInputSections(),
  rejectedInputs: {},
});
