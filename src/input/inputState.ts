import { z } from 'zod';
import { persistenceSchemas } from '../config/persistenceRegistry';
import {
  deserializeFieldAddress,
  serializedFieldAddressSchema,
  type FieldAddress,
} from './fieldAddress';

const nullablePersistenceSchemas = Object.fromEntries(
  Object.entries(persistenceSchemas).map(([section, schema]) => [section, schema.nullable()])
) as {
  [K in keyof typeof persistenceSchemas]: z.ZodNullable<(typeof persistenceSchemas)[K]>;
};

export const persistedInputSectionsSchema = z.object(nullablePersistenceSchemas).strict().readonly();

export const rejectedInputSchema = z.object({
  raw: z.string().min(1, 'Rejected input må ikke være tomt'),
}).strict().readonly();

export const rejectedInputsSchema = z.record(serializedFieldAddressSchema, rejectedInputSchema).readonly();

const persistedInputStateBaseSchema = z.object({
  sections: persistedInputSectionsSchema,
  rejectedInputs: rejectedInputsSchema,
}).strict().readonly();

export type PersistedInputSections = z.infer<typeof persistedInputSectionsSchema>;
export type RejectedInput = z.infer<typeof rejectedInputSchema>;
export type RejectedInputs = z.infer<typeof rejectedInputsSchema>;
export type PersistedInputState = z.infer<typeof persistedInputStateBaseSchema>;

export type KnownFieldAddressPredicate = (
  address: FieldAddress,
  sections: PersistedInputSections
) => boolean;

/**
 * Adresser skal valideres mod det konkrete feltkatalog. Den generelle schemastruktur kan kun
 * bevise formatet; factoryen gør katalogmedlemskab til en del af samme Zod-validering.
 */
export const createPersistedInputStateSchema = (isKnownFieldAddress: KnownFieldAddressPredicate) =>
  persistedInputStateBaseSchema.superRefine((input, context) => {
    for (const serializedAddress of Object.keys(input.rejectedInputs)) {
      const address = deserializeFieldAddress(serializedAddress);
      if (address === null || !isKnownFieldAddress(address, input.sections)) {
        context.addIssue({
          code: 'custom',
          path: ['rejectedInputs', serializedAddress],
          message: 'Feltadressen findes ikke i feltkataloget',
        });
      }
    }
  });

export const createEmptyPersistedInputSections = (): PersistedInputSections =>
  persistedInputSectionsSchema.parse(
    Object.fromEntries(Object.keys(persistenceSchemas).map((section) => [section, null]))
  );
